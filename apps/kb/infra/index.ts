import { Config } from '@pulumi/pulumi';


const config = new Config();

export default async () => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");


  return {
  };
};