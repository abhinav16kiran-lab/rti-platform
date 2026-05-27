import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from models import db, User, RTIPost, Comment, RequestedRTI
from pii import PIIRedactor  # Imported your PII sanitization pipeline

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS globally so your friend's React UI can communicate safely
CORS(app)

# Bind and initialize database variables
db.init_app(app)

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


# --- API ENDPOINTS ---

@app.route('/api/search', methods=['GET'])
def search_rtis():
    """Handles full-text lookups and automatically tracks zero-result dead ends"""
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify([])
    
    # Case-insensitive partial text lookups across either Titles or Extracted Document Text blocks
    search_pattern = f"%{query}%"
    results = RTIPost.query.filter(
        (RTIPost.title.ilike(search_pattern)) | 
        (RTIPost.extracted_text.ilike(search_pattern))
    ).all()
    
    # DEAD-END INTENT TRACKER SYSTEM: Logs failed attempts automatically
    if not results:
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
def upload_rti():
    """Manages form-data streams, files storage, and data record writing"""
    if 'rti_pdf' not in request.files:
        return jsonify({"error": "No PDF file partition supplied"}), 400
        
    file = request.files['rti_pdf']
    title = request.form.get('title')
    department = request.form.get('department')
    state = request.form.get('state', '')
    is_anon = request.form.get('is_anonymous', 'false').lower() == 'true'
    
    if file.filename == '':
        return jsonify({"error": "Empty file name chosen"}), 400

    # Ensure local directory is generated
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Save file asset cleanly to local disk partition
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)
    
    # Run the PDF through your automated text extraction and scrubbing engine
    extracted_text = redactor.process_document(file_path)

    # Hardcoding a demo user reference (User ID 1) for local system initialization testing
    demo_user = User.query.first()
    if not demo_user:
        demo_user = User(email="test_citizen@platform.in", password_hash="secure_stub_hash")
        db.session.add(demo_user)
        db.session.commit()

    new_post = RTIPost(
        user_id=demo_user.id,
        title=title,
        department=department,
        state=state,
        pdf_url=f"/static/uploads/{file.filename}",
        extracted_text=extracted_text,  # Storing the redacted safe text strings
        is_anonymous=is_anon
    )
    
    db.session.add(new_post)
    db.session.commit()
    
    return jsonify({"message": "RTI Post logged and sanitized successfully", "post_id": new_post.id}), 201


@app.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post_details(post_id):
    """Fetches full breakdown details for a unique record instance"""
    post = RTIPost.query.get_or_404(post_id)
    return jsonify(post.to_dict())


@app.route('/api/posts/<int:post_id>/comments', methods=['GET', 'POST'])
def handle_comments(post_id):
    """Processes message postings and fetches fully formatted thread tree components"""
    if request.method == 'POST':
        data = request.get_json()
        
        # Pull or verify test uploader user identity profile
        demo_user = User.query.first()
        
        new_comment = Comment(
            post_id=post_id,
            user_id=demo_user.id,
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