# VM Server setup
> The VM is in Google Cloud Engine

- project: 183307
- name of instance: nodeserver-1-vm
- zone: europe-west3-c
- Linux distribution: Ubuntu 16.04.4 LTS (xenial)

## Setup user for CI

```bash
adduser bitbucket
usermod -aG www-data bitbucket
chmod -R g+rwX /var/www
chown -R www-data:www-data /var/www
su - bitbucket
mkdir ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# paste SSH key
chmod 600 ~/.ssh/authorized_keys
exit
```

Test login in with ssh key:

    ssh -i ~/.ssh/bitbucket_onova_id_rsa bitbucket@35.198.83.175

## Firewall

    ufw allow OpenSSH
    ufw allow http
    ufw allow https

SSH rule should be already allowed.

    ufw enable

Check

    ufw status numbered

```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] OpenSSH                    ALLOW IN    Anywhere
[ 2] 80                         ALLOW IN    Anywhere
[ 3] 443                        ALLOW IN    Anywhere
[ 4] OpenSSH (v6)               ALLOW IN    Anywhere (v6)
[ 5] 80 (v6)                    ALLOW IN    Anywhere (v6)
[ 6] 443 (v6)                   ALLOW IN    Anywhere (v6)
```

## Node.js v8.x LTS Carbon and npm

```bash
curl -sL https://deb.nodesource.com/setup_8.x -o nodesource_setup.sh
bash nodesource_setup.sh
apt-get install nodejs build-essential

# test
nodejs -v
npm -v
```

## Nginx

```bash
apt-get install nginx
# test
systemctl status nginx
curl -4 icanhazip.com
# open http://__server_public_ip_address__
```

Configure default virtual host (for web app):

    nano /etc/nginx/sites-available/default

    server_name onova.co www.onova.co;

 Verify syntax of configuration files

    nginx -t

Example:

    nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
    nginx: configuration file /etc/nginx/nginx.conf test is successful

Reload:

    systemctl reload nginx

More settings:

- https://linode.com/docs/web-servers/nginx/tls-deployment-best-practices-for-nginx/
- https://gist.github.com/plentz/6737338

## SSL Certs

    add-apt-repository ppa:certbot/certbot
    apt-get update
    certbot --nginx -d onova.co -d www.onova.co

## Swap

## Unattended upgrades

## Security

### Fail2ban

## Misc

### UTC and install NTP
