# VM Server setup
> The VM is in Google Cloud Engine

- project: 183307
- name of instance: nodeserver-1-vm
- zone: europe-west3-c
- Linux distribution: Ubuntu 16.04.4 LTS (xenial)

## Initial setup
  
    sudo su
    apt-get update
    apt-get dist-upgrade

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
- https://cipherli.st

## SSL Certs

Taken from: [How To Secure Nginx with Let's Encrypt on Ubuntu 16.04 | DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-16-04)
> October 27, 2017

```bash
add-apt-repository ppa:certbot/certbot
apt-get update
certbot --nginx -d onova.co -d www.onova.co

# Verify Certbot Auto-Renewal
certbot renew --dry-run
```

Check cron job: `/etc/cron.d/certbot` 

## Swap

Taken from: [How To Add Swap Space on Ubuntu 16.04 | DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-16-04)
> April 25, 2016

```bash
# test
swapon --show
# test
free -h

fallocate -l 1G /swapfile
chmod 600 /swapfile

mkswap /swapfile
```

Example output:

    Setting up swapspace version 1, size = 1024 MiB (1073737728 bytes)
    no label, UUID=c49fd825-67ef-4978-8f32-d37ecf632192
    
```bash
swapon /swapfile
# test
swapon --show
```

Example:

    NAME      TYPE  SIZE USED PRIO
    /swapfile file 1024M   0B   -1

```bash
free -h
```

Example:

                  total        used        free      shared  buff/cache   available
    Mem:           3.6G        104M        2.3G        5.3M        1.2G        3.2G
    Swap:          1.0G          0B        1.0G
    
### Adjusting the Swappiness Property

    cat /proc/sys/vm/swappiness
    60
    sysctl vm.swappiness=10
    nano /etc/sysctl.conf
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

### Adjusting the Cache Pressure Setting

    cat /proc/sys/vm/vfs_cache_pressure
    100
    sysctl vm.vfs_cache_pressure=50
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

## Unattended upgrades

    apt-get install unattended-upgrades
    
Configure to auto-remove old dependencies:
    
    nano /etc/apt/apt.conf.d/50unattended-upgrades

with:
    
    Unattended-Upgrade::Remove-Unused-Dependencies "true";
    
Set schedule:

    nano /etc/apt/apt.conf.d/10periodic
    
with:

    APT::Periodic::Unattended-Upgrade "7";

## Security

### Fail2ban

Note: `sshguard` should be already installed

```bash
apt-get install fail2ban
cp /etc/fail2ban/fail2ban.conf /etc/fail2ban/fail2ban.local
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
# edit the maxretry to 3
nano /etc/fail2ban/jail.local
systemctl restart fail2ban

# test
fail2ban-client status
fail2ban-client status sshd
```

## Misc

    apt-get install git

### UTC timezone and NTC sync

```bash
date
timedatectl set-timezone UTC

# test
date

timedatectl
```

Example:

          Local time: Wed 2018-04-04 11:12:10 UTC
      Universal time: Wed 2018-04-04 11:12:10 UTC
            RTC time: Wed 2018-04-04 11:12:10
           Time zone: UTC (UTC, +0000)
     Network time on: yes
    NTP synchronized: yes
     RTC in local TZ: no

## Node.js App

    npm install pm2 -g
    
Ensure that your Node.js application starts automatically when your server boots up

```bash
sudo su - bitbucket
pm2 startup systemd
exit
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u bitbucket --hp /home/bitbucket
```


### Set Up Nginx as a Reverse Proxy Server

TODO: https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-16-04#set-up-nginx-as-a-reverse-proxy-server