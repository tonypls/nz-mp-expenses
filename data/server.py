import http.server
import socketserver
import json
import os

os.makedirs('data/expenses', exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            payload = json.loads(post_data.decode('utf-8'))
            filename = payload.get('filename')
            csv = payload.get('csv')
            
            if filename and csv:
                filepath = os.path.join('data/expenses', filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(csv)
                print(f"Successfully saved {filepath}")
        except Exception as e:
            print(f"Error handling POST: {e}")
            
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b"OK")

print("Starting server on port 8123...")
with socketserver.TCPServer(("", 8123), Handler) as httpd:
    httpd.serve_forever()
