import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, User, RTIPost, Comment, RequestedRTI
from pii import PIIRedactor  # Imported your PII sanitization pipeline
from flask import send_from_directory

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS globally so your friend's React UI can communicate safely
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Bind and initialize database variables
db.init_app(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Initialize the PII scrubbing engine
redactor = PIIRedactor()

# Automatically generate PostgreSQL tables on boot up inside local workspace environment
with app.app_context():
    db.create_all()

# --- RECURSIVE COMMENT TREE HELPER ---
def build_comment_tree(comments_list):
    """Organizes flat database rows into an infinite nested tree hierarchy"""
    comment_map = {comment.id: comment.to_dict() for comment in comments_list}
    tree = []
    
    for comment in comments_list:
        comment_dict = comment_map[comment.id]
        if comment.parent_id is None:
            # Top-level item goes straight into the root list
            tree.append(comment_dict)
        else:
            # Sub-reply gets nested right inside its structural parent's list
            parent = comment_map.get(comment.parent_id)
            if parent:
                parent['replies'].append(comment_dict)
    return tree


# --- AUTH ENDPOINTS ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400
        
    hashed_pw = generate_password_hash(password, method='scrypt')
    new_user = User(email=email, password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    return jsonify({"message": "Registered successfully", "user": {"id": new_user.id, "email": new_user.email}})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    
    if user and check_password_hash(user.password_hash, data.get('password')):
        login_user(user)
        return jsonify({"message": "Logged in successfully", "user": {"id": user.id, "email": user.email}})
        
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/auth/me', methods=['GET'])
def current_user_info():
    if current_user.is_authenticated:
        return jsonify({"user": {"id": current_user.id, "email": current_user.email}})
    return jsonify({"user": None}), 401


# --- API ENDPOINTS ---

@app.route('/api/departments', methods=['GET'])
def get_departments():
    """Fetches unique ministries for navigation filters"""
    departments = db.session.query(RTIPost.department).distinct().all()
    return jsonify([dep[0] for dep in departments if dep[0]])

@app.route('/api/posts/me', methods=['GET'])
@login_required
def get_my_posts():
    """Fetches posts uploaded by current user"""
    posts = RTIPost.query.filter_by(user_id=current_user.id).order_by(RTIPost.created_at.desc()).all()
    return jsonify([post.to_dict() for post in posts])

@app.route('/api/search', methods=['GET'])
def search_rtis():
    """Handles full-text lookups and automatically tracks zero-result dead ends"""
    query = request.args.get('q', '').strip()
    department = request.args.get('department', '').strip()
    
    if not query and not department:
        return jsonify([])
        
    sql_query = RTIPost.query
    
    if department:
        sql_query = sql_query.filter(RTIPost.department == department)
        
    if query:
        search_pattern = f"%{query}%"
        # Using db.or_ and coalesce guarantees NULL safety regardless of DB engine
        # ADDED description to search query logic
        sql_query = sql_query.filter(
            db.or_(
                RTIPost.title.ilike(search_pattern),
                RTIPost.description.ilike(search_pattern),
                db.func.coalesce(RTIPost.extracted_text, '').ilike(search_pattern)
            )
        )
        
    results = sql_query.all()
    
    # DEAD-END INTENT TRACKER SYSTEM: Logs failed attempts automatically
    if not results and query:
        existing_request = RequestedRTI.query.filter_by(keyword=query.lower()).first()
        if existing_request:
            existing_request.request_count += 1
        else:
            new_request = RequestedRTI(keyword=query.lower())
            db.session.add(new_request)
        db.session.commit()
        return jsonify([]) # Return clean empty array so frontend triggers request tracker button
        
    return jsonify([post.to_dict() for post in results])


@app.route('/api/upload-rti', methods=['POST'])
@login_required
def upload_rti():
    """Manages form-data streams, files storage, and data record writing"""
    if 'rti_pdf' not in request.files:
        return jsonify({"error": "No PDF file partition supplied"}), 400
        
    file = request.files['rti_pdf']
    title = request.form.get('title')
    description = request.form.get('description')
    department = request.form.get('department')
    state = request.form.get('state', '')
    is_anon = request.form.get('is_anonymous', 'false').lower() == 'true'
    
    if not description or not description.strip():
         return jsonify({"error": "Description is mandatory for indexing backup"}), 400

    if file.filename == '':
        return jsonify({"error": "Empty file name chosen"}), 400

    # Ensure local directories are generated
    vault_folder = os.path.join(app.root_path, 'vault')
    uploads_folder = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(vault_folder, exist_ok=True)
    os.makedirs(uploads_folder, exist_ok=True)
    
    # Save raw original file to the secure vault
    raw_file_path = os.path.join(vault_folder, file.filename)
    file.save(raw_file_path)
    
    # Define where the scrubbed file will go
    scrubbed_filename = f"scrubbed_{file.filename}"
    scrubbed_file_path = os.path.join(uploads_folder, scrubbed_filename)

    # Run the PDF through physical redaction, which creates the scrubbed file
    extracted_text = redactor.process_document(raw_file_path, scrubbed_file_path)

    new_post = RTIPost(
        user_id=current_user.id,
        title=title,
        description=description,
        department=department,
        state=state,
        pdf_url=f"/api/download/", # Will append ID below after commit
        original_filename=file.filename,
        extracted_text=extracted_text,  # Storing the redacted safe text strings
        is_anonymous=is_anon
    )
    
    db.session.add(new_post)
    db.session.flush() # Get the ID before committing
    new_post.pdf_url = f"/api/download/{new_post.id}"
    db.session.commit()
    
    return jsonify({"message": "RTI Post logged and sanitized successfully", "post_id": new_post.id}), 201


@app.route('/api/download/<int:post_id>', methods=['GET'])
def download_scrubbed_pdf(post_id):
    """Secure gatekeeper route that only serves the scrubbed version of the PDF"""
    post = RTIPost.query.get_or_404(post_id)
    
    uploads_folder = os.path.join(app.root_path, 'static', 'uploads')
    scrubbed_filename = f"scrubbed_{post.original_filename}"
    
    file_path = os.path.join(uploads_folder, scrubbed_filename)
    if not os.path.exists(file_path):
         return jsonify({"error": "Redacted file not found on server"}), 404
         
    return send_from_directory(uploads_folder, scrubbed_filename, as_attachment=False)


@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post_details(post_id):
    """Fetches full breakdown details for a unique record instance"""
    post = RTIPost.query.get_or_404(post_id)
    return jsonify(post.to_dict())


@app.route('/api/posts/<int:post_id>/comments', methods=['GET', 'POST'])
@login_required
def handle_comments(post_id):
    """Processes message postings and fetches fully formatted thread tree components"""
    if request.method == 'POST':
        data = request.get_json()
        
        new_comment = Comment(
            post_id=post_id,
            user_id=current_user.id,
            parent_id=data.get('parent_id'), # Null if top-level, Integer ID if nested reply
            comment_text=data.get('comment_text')
        )
        db.session.add(new_comment)
        db.session.commit()
        return jsonify({"message": "Comment recorded successfully", "comment_id": new_comment.id}), 201

    # GET Request processing branch: Gathers all text elements and returns tree object
    all_comments = Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at.asc()).all()
    nested_tree = build_comment_tree(all_comments)
    return jsonify(nested_tree)


@app.route('/api/request-rti', methods=['POST'])
def explicit_intent_request():
    """Manual tracking bridge for the 'Request this RTI' user selection choice"""
    data = request.get_json()
    keyword = data.get('keyword', '').strip().lower()
    
    if not keyword:
        return jsonify({"error": "Empty tracking target keyword supplied"}), 400
        
    track_item = RequestedRTI.query.filter_by(keyword=keyword).first()
    if track_item:
        track_item.request_count += 1
    else:
        track_item = RequestedRTI(keyword=keyword)
        db.session.add(track_item)
        
    db.session.commit()
    return jsonify({"status": "Intent metrics incremented successfully", "count": track_item.request_count})


if __name__ == '__main__':
    app.run(debug=True, port=5000)