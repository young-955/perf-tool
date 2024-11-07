from uuid import uuid4
import os
import shutil
from datetime import datetime, timedelta

class TestSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.created_at = datetime.now()
        self.results_dir = None
        self.setup_directories()
        
    def setup_directories(self):
        base_dir = os.path.join(os.path.dirname(__file__), '..', 'results')
        self.results_dir = os.path.join(base_dir, self.session_id)
        os.makedirs(self.results_dir, exist_ok=True)
        
    def cleanup(self):
        if os.path.exists(self.results_dir):
            shutil.rmtree(self.results_dir)

class SessionManager:
    def __init__(self):
        self.sessions = {}
        self.session_timeout = timedelta(hours=1)
        
    def create_session(self):
        session_id = str(uuid4())
        session = TestSession(session_id)
        self.sessions[session_id] = session
        return session_id
        
    def get_session(self, session_id):
        session = self.sessions.get(session_id)
        if session and datetime.now() - session.created_at < self.session_timeout:
            return session
        return None
        
    def cleanup_expired_sessions(self):
        current_time = datetime.now()
        expired_sessions = [
            session_id for session_id, session in self.sessions.items()
            if current_time - session.created_at >= self.session_timeout
        ]
        for session_id in expired_sessions:
            self.sessions[session_id].cleanup()
            del self.sessions[session_id]