import requests
import time
import sys

BASE_URL = "http://localhost:8000/api/v1"

def wait_for_service():
    print("Waiting for API Gateway...")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                print("API Gateway is up!")
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(2)
        print(".", end="", flush=True)
    print("\nTimeout waiting for service")
    return False

def test_login():
    print("\nTesting login...")
    payload = {
        "usernameOrEmail": "simmonscs28@gmail.com",
        "password": "password123" # Trying default first, then admin123
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload)
        if response.status_code == 200:
            print("Login successful!")
            print(f"Token: {response.json().get('token')[:20]}...")
            return True
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            
            # Try with admin123
            print("Retrying with 'admin123'...")
            payload["password"] = "admin123"
            response = requests.post(f"{BASE_URL}/auth/login", json=payload)
            if response.status_code == 200:
                print("Login successful with admin123!")
                print(f"Token: {response.json().get('token')[:20]}...")
                return True
            else:
                print(f"Login failed again: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        print(f"Error during login: {e}")
        return False

if __name__ == "__main__":
    if wait_for_service():
        if test_login():
            print("Authentication test passed!")
        else:
            print("Authentication test failed!")
            sys.exit(1)
    else:
        sys.exit(1)
