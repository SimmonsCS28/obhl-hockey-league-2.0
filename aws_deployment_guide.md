# AWS Deployment Guide: OBHL Hockey League

This guide walks you through deploying your full stack application to an **AWS EC2** instance using Docker Compose.

> [!IMPORTANT]
> **Recommended Instance Size**: **t3.medium** (2 vCPU, 4GB RAM).
> Smaller instances (Free Tier t2.micro) will likely crash with this many Java services.

## Phase 1: Launch Infrastructure

1.  **Log in to AWS Console** and navigate to **EC2**.
2.  Click **Launch Instance**.
3.  **Name**: `OBHL-Server`
4.  **OS Image**: **Ubuntu Server 24.04 LTS** (or 22.04 LTS).
5.  **Instance Type**: Select **t3.medium**.
6.  **Key Pair**: Create a new key pair (e.g., `obhl-key`), download the `.pem` file, and **save it safely**.
7.  **Network Settings**:
    *   Check both **Allow HTTP traffic from the internet** and **Allow HTTPS traffic from the internet**.
    *   Ensure **Allow SSH traffic** is checked (My IP recommended for security, or Anywhere for ease).
8.  **Storage**: Set to **20 GB** (gp3) to ensure you have space for Docker images.
9.  Click **Launch Instance**.

## Phase 2: Connect to Server
We will use VS Code's "Remote - SSH" extension for the easiest experience.

1.  Open VS Code locally.
2.  Install the **Remote - SSH** extension (by Microsoft) if you haven't.
3.  Click the Green/Blue button in the bottom-left corner > **Connect to Host...**.
4.  Select **Configure SSH Hosts...** -> Select your user config file.
5.  Add this entry:
    ```
    Host obhl-aws
        HostName <YOUR_EC2_PUBLIC_IP_ADDRESS>
        User ubuntu
        IdentityFile "C:\path\to\your\obhl-key.pem"
    ```
6.  Save, click the Remote button again > **Connect to Host** > Select `obhl-aws`.
7.  Accept the fingerprint (Linux). You are now in!

## Phase 3: Install Docker
Run these commands in the VS Code terminal (connected to the server):

```bash
# Update packages
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# add your user to docker group (avoids typing sudo for docker)
sudo usermod -aG docker $USER
```
**CRITICAL**: Disconnect (Close VS Code window) and Reconnect for the group change to take effect!

## Phase 4: Deploy Code
1.  Reconnect to the server.
2.  Clone your repository (if public) or copy your files.
    *   *Easiest way with VS Code Remote*: Just drag and drop your `frontend` folder, `backend` folder, and `docker-compose.yml` into the file explorer on the left!
    *   *Or use Git*: `git clone https://github.com/your-user/obhl-hockey-league-2.0.git`
3.  Navigate to the folder:
    ```bash
    cd obhl-hockey-league-2.0
    ```
4.  Run the application:
    ```bash
    docker compose up -d --build
    ```
    *This will take a few minutes to build, especially the frontend.*

## Phase 5: Verification
1.  Look up your **EC2 Public IP address** in the AWS Console.
2.  Open your browser and go to `http://<YOUR_PUBLIC_IP>`.
3.  You should see your OBHL App running!

## Troubleshooting
- **Frontend not loading?** Check "Security Groups" in AWS EC2 to ensure Port 80 (HTTP) is open to 0.0.0.0/0.
- **Backend errors?** Run `docker compose logs -f` to see live logs.
