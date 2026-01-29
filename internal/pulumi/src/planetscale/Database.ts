import { local } from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

interface DatabaseArgs {
  name: string;
  organization: string;
  clusterSize: string;
  engine: string;
}

export class Database extends pulumi.ComponentResource {
  public readonly name: string;
  public readonly organization: string;
  public readonly clusterSize: string;
  public readonly engine: string;

  constructor(name: string, args: DatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
    super('custom:planetscale:Database', name, args, opts);
    this.name = args.name;
    this.organization = args.organization;
    this.clusterSize = args.clusterSize;
    this.engine = args.engine;

    const version = new local.Command('get-version', {
      create: `pscale version -f json`,
    }, { parent: this });

    const create = new local.Command('create-database', {
      create: `pscale database create ${this.name} --organization ${this.organization} --cluster-size ${this.clusterSize} --engine ${this.engine} -f json`,
      delete: `pscale database delete ${this.name} --organization ${this.organization} --cluster-size ${this.clusterSize} --engine ${this.engine} -f json`,
    }, { parent: this });

    version.stdout.apply(stdout => console.log(stdout));
    create.stdout.apply(stdout => console.log(stdout));

    this.registerOutputs({
      name: this.name,
      organization: this.organization,
      clusterSize: this.clusterSize,
      engine: this.engine,
    });
  }

}