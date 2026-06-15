import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.error

# Port for local server
PORT = 8765
SERVER_URL = f"http://127.0.0.1:{PORT}"
TEST_PAGE_URL = f"{SERVER_URL}/dev/browser.html?runTests=true"

def is_server_running():
    try:
        with urllib.request.urlopen(SERVER_URL, timeout=1) as response:
            return response.status == 200
    except (urllib.error.URLError, ConnectionResetError, ConnectionRefusedError):
        return False

def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        print("Playwright is not installed. Installing standard playwright python package...")
        try:
            # Install package
            subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
            # Install chromium browser binary
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            
            # Try importing again
            from playwright.sync_api import sync_playwright
            return sync_playwright
        except Exception as e:
            print(f"Error installing Playwright: {e}")
            sys.exit(1)

def run_tests():
    # 1. Start HTTP Server
    server_process = None
    if not is_server_running():
        print(f"Starting local HTTP server on port {PORT}...")
        # Start server in workspace root to allow absolute paths resolving correctly
        # The script is in dev/, so workspace root is one level up
        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        server_process = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
            cwd=workspace_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        # Wait for server to start
        retries = 30
        while not is_server_running() and retries > 0:
            time.sleep(0.2)
            retries -= 1
            
        if retries == 0:
            print("Failed to start HTTP server.")
            if server_process:
                server_process.terminate()
            sys.exit(1)
        print("HTTP server is up and running.")
    else:
        print(f"Server is already running on port {PORT}. Using existing server.")

    # 2. Setup Playwright E2E Driver
    sync_playwright = ensure_playwright()

    print(f"Opening headless browser at {TEST_PAGE_URL}...")
    success = False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Setup console logger from browser to terminal
            page.on("console", lambda msg: print(f"[Browser Console] {msg.text}"))
            
            page.goto(TEST_PAGE_URL)
            
            print("Waiting for E2E tests to finish (timeout: 45s)...")
            # Wait for #test-results to have data-status of PASS or FAIL
            page.wait_for_selector(
                '#test-results[data-status="PASS"], #test-results[data-status="FAIL"]',
                timeout=45000
            )
            
            results_element = page.query_selector('#test-results')
            status = results_element.get_attribute('data-status')
            raw_content = results_element.inner_text()
            
            print("\n================ TEST EXECUTION RESULTS ================")
            print(f"Overall Status: {status}")
            
            try:
                results = json.loads(raw_content)
                print(f"Passed: {results.get('passCount', 0)} / {results.get('totalCount', 0)}")
                print(f"Failed: {results.get('failCount', 0)} / {results.get('totalCount', 0)}")
                print("--------------------------------------------------------")
                
                # Sort and print logs nicely
                logs = results.get('logs', [])
                for log in logs:
                    badge = "✓ PASS" if log['status'] == 'PASS' else "✗ FAIL"
                    print(f"[{log['tier']} - {log['category']}] {log['id']} {log['name']}: {badge}")
                    if log['error']:
                        print(f"   ↳ Error: {log['error']}")
                
                if status == 'PASS':
                    success = True
            except json.JSONDecodeError:
                print("Failed to parse JSON execution logs from page:")
                print(raw_content)
                
            browser.close()
    except Exception as e:
        print(f"E2E Run Error occurred: {e}")
    finally:
        # 4. Clean up Server
        if server_process:
            print("Stopping local HTTP server...")
            server_process.terminate()
            server_process.wait()
            
    if not success:
        print("\nTest execution finished with errors.")
        sys.exit(1)
    else:
        print("\nAll tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    run_tests()
