# Dockview

A focused, lightweight Docker server dashboard with live container metrics and essential runtime controls. Dockview has no database and no runtime npm dependencies—it talks directly to the Docker Engine API and serves a responsive web console from a single container.

## Features

- Live CPU, memory, and network I/O metrics with five-second refreshes
- Running and stopped container inventory with images, ports, and status
- Host overview with Docker version, operating system, CPU, and memory
- Container details including IP address, mounts, labels, and restart policy
- Start, stop, and restart controls with operator confirmation
- Search and state filtering
- Responsive dark UI with dedicated metric typography
- API-key protection and a browser-local authentication flow
- Zero runtime package dependencies

## Install on a Linux server

Docker Engine and the Docker Compose plugin are required.

```bash
git clone https://github.com/Amir-Ali-Dev/dockview.git
cd dockview
chmod +x install.sh
./install.sh
```

Open `http://SERVER_IP:3000` and enter the API key printed by the installer. The installer also detects the Docker socket group automatically, allowing Dockview to run as a non-root container user.

To change the public port, edit `DOCKVIEW_PORT` in `.env`, then apply it:

```bash
docker compose up -d
```

## Development

On Linux or WSL with the Docker socket in its standard location:

```bash
npm start
```

Supported environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Internal HTTP listen port |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker Engine socket path |
| `API_TOKEN` | Empty | API access key; required by Compose |
| `DOCKVIEW_PORT` | `3000` | Published host port in Compose |
| `DOCKER_GID` | Detected | Host Docker socket group ID |

## Security

Access to `/var/run/docker.sock` effectively grants administrative control over the Docker host. Do not expose Dockview directly to the public internet. Use HTTPS, a VPN, or an authenticated reverse proxy, restrict access with a firewall, and keep a strong `API_TOKEN`.

For hardened deployments, place a Docker socket proxy with an explicit endpoint allowlist between Dockview and the Docker daemon.

## Roadmap

- Full Images, Volumes, and Networks views
- Container logs and an optional terminal
- Resource history and alerting
- Multi-host management with a dedicated agent
- Users, roles, and OIDC authentication

## License

[MIT](LICENSE)
