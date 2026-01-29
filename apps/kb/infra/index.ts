
import { CloudflareTunnel, composeConfigFromTunnel } from '@conservation-stream/internal-pulumi/cloudflare/Tunnel';
import { cloudConfigFromCompose, Compose } from '@conservation-stream/internal-pulumi/compose/Compose';
import { CloudInit } from '@conservation-stream/internal-pulumi/init/CloudInit';
import { Database } from '@conservation-stream/internal-pulumi/planetscale/Database';
import { getZonesOutput } from '@pulumi/cloudflare';
import { remote } from "@pulumi/command";
import { Droplet, SshKey } from '@pulumi/digitalocean';
import { all, asset, getStack, interpolate } from '@pulumi/pulumi';
import * as random from "@pulumi/random";
import { PrivateKey } from '@pulumi/tls';

const stack = getStack();
const id = `kb-${stack.slice(0, 4)}`;

export default async () => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");

  const zones = getZonesOutput();
  const zoneId = zones.apply(zones => {
    const zone = zones.results.find(zone => zone.name === 'conservation.stream');
    if (!zone) throw new Error("Zone not found");
    return zone.id;
  });

  const tunnel = new CloudflareTunnel(`${id}-tunnel`, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    zoneId,
    ingress: [
      {
        hostname: 'editor.conservation.stream',
        service: 'http://outline:3000',
      }
    ],
  });

  const secretKey = new random.RandomBytes(`${id}-secret`, {
    length: 32,
  });

  const utilsKey = new random.RandomBytes(`${id}-utils`, {
    length: 32,
  });


  const database = new Database(`${id}-db`, {
    name: "outline-kb",
    organization: "conservationstream",
    clusterSize: "PS-5-AWS-X86",
    engine: "postgresql",
    replicas: 0,
    region: "aws-us-east-2",
  });


  const compose = new Compose(`${id}-compose`, {
    name: "outline",
    dir: "/opt/outline",
    config: {
      services: {
        outline: {
          image: 'docker.getoutline.com/outlinewiki/outline:latest',
          environment: {
            NODE_ENV: "production",
            PORT: "3000",
            URL: 'https://editor.conservation.stream',
            COLLABORATION_URL: 'https://editor.conservation.stream',
            DEFAULT_LANGUAGE: "en_US",
            WEB_CONCURRENCY: "1",
            SECRET_KEY: secretKey.hex,
            UTILS_SECRET: utilsKey.hex,

            DATABASE_URL: database.role.database_url,

            REDIS_URL: 'redis://redis:6379',


            FILE_STORAGE: 's3',
            FILE_STORAGE_UPLOAD_MAX_SIZE: '262144000',

            AWS_ACCESS_KEY_ID: 'a',
            AWS_SECRET_ACCESS_KEY: 'a',
            AWS_REGION: 'auto',
            AWS_S3_UPLOAD_BUCKET_URL: 'https://notreal.com',
            AWS_S3_UPLOAD_BUCKET_NAME: 'notreal',
            AWS_S3_FORCE_PATH_STYLE: 'true',
            AWS_S3_ACL: 'private',

            FORCE_HTTPS: 'false',

            // OIDC_CLIENT_ID: 'a',
            // OIDC_CLIENT_SECRET: 'a',
            // OIDC_AUTH_URI: 'a',
            // OIDC_TOKEN_URI: 'a',
            // OIDC_USERINFO_URI: 'a',
            // OIDC_LOGOUT_URI: 'a',

            // OIDC_USERNAME_CLAIM: 'preferred_username',
            // OIDC_DISPLAY_NAME: 'conservation.stream',
            // OIDC_SCOPES: 'openid email profile',

            RATE_LIMITER_ENABLED: 'true',
            RATE_LIMITER_REQUESTS: '1000',
            RATE_LIMITER_DURATION_WINDOW: '60',

            ENABLE_UPDATES: 'false',
            // DEBUG: 'http',
            LOG_LEVEL: 'info',
          }
        },
        redis: {
          image: 'redis',
          user: 'redis:redis'
        },
        ...composeConfigFromTunnel(tunnel),
      },
    },
  });

  const cloudInit = new CloudInit(`${id}-init`, {
    settings: {
      docker: true,
    },
    services: {
      ...cloudConfigFromCompose(compose),
    },
  });

  const sshKey = new PrivateKey(`${id}-key`, {
    algorithm: "RSA",
    rsaBits: 4096,
  });

  const ssh = new SshKey(`${id}-key`, {
    publicKey: sshKey.publicKeyOpenssh,
  });

  const web = new Droplet(`${id}-droplet`, {
    image: "ubuntu-24-04-x64",
    size: "s-1vcpu-1gb-35gb-intel",
    region: "atl1",
    userData: cloudInit.rendered,
    sshKeys: [ssh.id],
  });

  const connection = all([web.ipv4Address, sshKey.privateKeyPem]).apply(([host, pem]) => ({
    host,
    user: "root",
    privateKey: pem.toString(),
  }));


  const waitForCloudInit = new remote.Command(`${id}-wait-init`, {
    create: `bash -lc 'set -eu; cloud-init status --wait --long'`,
    connection,
    triggers: [web],
  });

  const file = new remote.CopyToRemote(`${id}-compose-file`, {
    connection,
    remotePath: interpolate`${compose.dir}/docker-compose.yml`,
    source: new asset.FileAsset(compose.path),
    triggers: [compose.rendered],
  }, { dependsOn: [compose, waitForCloudInit] });

  const testCmd = new remote.Command(`${id}-up`, {
    create: interpolate`docker compose -f ${compose.dir}/docker-compose.yml up -d --remove-orphans`,
    connection,
    triggers: [compose.rendered],
  }, { dependsOn: [file, compose, waitForCloudInit] });

  return {
    database
  };
};