import os

class Config:
    # Secret key used by Flask for securely signing sessions and cookies
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-dev-key-keep-it-safe'
    
    # Define local directory where uploaded PDFs will be saved on your hard drive
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'local_pdf_store')
    
    # Enforce a strict 16MB file upload limit to protect your server
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  
    
    # Database Connection URI for PostgreSQL
    # Syntax: postgresql://[user]:[password]@[host]:[port]/[database_name]
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://postgres:abhinav@localhost:5432/rti_db'
        
    # Disables SQLAlchemy's overhead tracking feature to save system memory
    SQLALCHEMY_TRACK_MODIFICATIONS = False