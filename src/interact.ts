/**
 * To run locally:
 * Build the project: `$ npm run build`
 * Run with node:     `$ node build/src/interact.js`.
 */

import {
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleTree,
} from 'o1js';

import { Semaphore } from './Semaphore.js';
import { ClaimantAccount } from './ClaimantAccount.js';

const doProofs = true;

//   class MyMerkleWitness extends MerkleWitness(8) {}

type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

// the zkApp account
let zkAppKey = PrivateKey.random();
let zkAppAddress = zkAppKey.toPublicKey();
let initialBalance = 100_000_000

// this map serves as our off-chain in-memory storage
let ClaimantAccounts: Map<string, ClaimantAccount> = new Map<Names, ClaimantAccount>(
  ['Bob', 'Alice', 'Charlie', 'Olivia'].map((name: string, index: number) => {
    return [
      name as Names,
      new ClaimantAccount({
        publicKey: Local.testAccounts[index].publicKey
      }),
    ];
  })
);

// we now need "wrap" the Merkle tree around our off-chain storage
// we initialize a new Merkle Tree with height 8
const Tree = new MerkleTree(8);

Tree.setLeaf(0n, ClaimantAccounts.get('Bob')!.hash());
Tree.setLeaf(1n, ClaimantAccounts.get('Alice')!.hash());
Tree.setLeaf(2n, ClaimantAccounts.get('Charlie')!.hash());
Tree.setLeaf(3n, ClaimantAccounts.get('Olivia')!.hash());

const claimantsRoot = Tree.getRoot();

let zkApp = new Semaphore(zkAppAddress);
console.log('Deploying semaphore..');
if (doProofs) {
  await Semaphore.compile();
}

let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer).send({
    to: zkAppAddress,
    amount: initialBalance,
  });
  zkApp.deploy();
});
await tx.prove();
await tx.sign([feePayerKey, zkAppKey]).send();

console.log('Initial claimants root: ' +  zkApp.claimantsRoot.get());

console.log('Setting claimants root to: ' +  claimantsRoot);
const txn = await Mina.transaction(zkAppAddress, () => {
  zkApp.setClaimantsRoot(claimantsRoot);
});

await txn.sign([zkAppKey]).send();

console.log('Updated claimants root: ' +  zkApp.claimantsRoot.get());