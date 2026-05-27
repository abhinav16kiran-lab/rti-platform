from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize the SQLAlchemy instance
db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Links to track what this user has posted/commented
    posts = db.relationship('RTIPost', backref='author_profile', lazy=True)
    comments = db.relationship('Comment', backref='commenter', lazy=True)


class RTIPost(db.Model):
    __tablename__ = 'rti_posts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=True)
    pdf_url = db.Column(db.Text, nullable=False)
    extracted_text = db.Column(db.Text, nullable=True)
    
    # Anonymity masking flag
    is_anonymous = db.Column(db.Boolean, default=False, nullable=False)
    
    # Document verification statuses: 'pending', 'verified', 'flagged'
    status = db.Column(db.String(20), default='pending', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Cascade deletes: If an RTI post is removed, remove all its comments too
    comments = db.relationship('Comment', backref='post', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        """Helper to convert database rows into clean JSON for React"""
        return {
            "id": self.id,
            "title": self.title,
            "department": self.department,
            "state": self.state,
            "pdf_url": self.pdf_url,
            "extracted_text": self.extracted_text,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "author": "Anonymous Citizen" if self.is_anonymous else self.author_profile.email
        }


class Comment(db.Model):
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('rti_posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Self-Referencing Foreign Key: Points to the parent comment's ID
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    comment_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Establishes the relationship pathway back into its own table for nested loops
    replies = db.relationship(
        'Comment', 
        backref=db.backref('parent', remote_side=[id]), 
        cascade='all, delete-orphan',
        lazy='select'
    )

    def to_dict(self):
        """Formats the comment node properties into a clear layout structure"""
        return {
            "id": self.id,
            "post_id": self.post_id,
            "parent_id": self.parent_id,
            "comment_text": self.comment_text,
            "created_at": self.created_at.isoformat(),
            "author": self.commenter.email.split('@')[0], # Safe fallback display identity
            "replies": [] # Populated dynamically by the controller logic tree
        }


class RequestedRTI(db.Model):
    __tablename__ = 'requested_rtis'
    
    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(150), unique=True, nullable=False)
    request_count = db.Column(db.Integer, default=1, nullable=False)
    last_requested_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)