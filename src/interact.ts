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
  Field,
} from 'o1js';

import { Semaphore } from './Semaphore.js';
import { ClaimantAccount, ClaimantMerkleWitness } from './ClaimantAccount.js';
import { Witness } from 'o1js/dist/node/lib/merkle_tree.js';

const doProofs = true;

type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

// the zkApp account
let zkAppKey = PrivateKey.random();
let zkAppAddress = zkAppKey.toPublicKey();

const initialBalance = 100_000_000
let claimantIndexes = new Map<string, bigint>([
  ['Bob', 0n],
  ['Alice', 1n],
  ['Charlie', 2n],
  ['Olivia', 3n]
]);

// this map serves as our off-chain in-memory storage
let Claimants: Map<string, {account: ClaimantAccount, privateKey: PrivateKey}> = new Map<Names, {account: ClaimantAccount, privateKey: PrivateKey}>(
  Array.from(claimantIndexes.keys()).map((name: string, index: number) => {
    return [
      name as Names,
      {account: 
      new ClaimantAccount({
        publicKey: Local.testAccounts[index].publicKey
      }),
      privateKey: Local.testAccounts[index].privateKey
    }
    ];
  })
);

function getClaimant(name: Names): {account: ClaimantAccount, privateKey: PrivateKey} {
  let claimant = Claimants.get(name)!;
  let account = claimant.account;
  let privateKey = claimant.privateKey;

  return {account, privateKey};
}

function getWitness(name: Names): ClaimantMerkleWitness {
  let idx = claimantIndexes.get(name)!;
  let w = Tree.getWitness(idx);
  return new ClaimantMerkleWitness(w);
}

async function claim(name: Names) {
  let {account, privateKey} = getClaimant(name);
  let witness = getWitness(name);

  let tx = await Mina.transaction(account.publicKey, () => {
    zkApp.claim(witness);
  });
  await tx.prove();
  await tx.sign([privateKey]).send();
}

async function release(name: Names) {
  let {account, privateKey} = getClaimant(name);

  let tx = await Mina.transaction(account.publicKey, () => {
    zkApp.release();
  });
  await tx.prove();
  await tx.sign([privateKey]).send();
}

// we now need "wrap" the Merkle tree around our off-chain storage
// we initialize a new Merkle Tree with height 8
const Tree = new MerkleTree(8);

Tree.setLeaf(claimantIndexes.get('Bob')!, Claimants.get('Bob')!.account.hash());
Tree.setLeaf(claimantIndexes.get('Alice')!, Claimants.get('Alice')!.account.hash());
Tree.setLeaf(claimantIndexes.get('Charlie')!, Claimants.get('Charlie')!.account.hash());
Tree.setLeaf(claimantIndexes.get('Olivia')!, Claimants.get('Olivia')!.account.hash());

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

console.log('\n-- -- --\n');
console.log('Initial claimants root: ' +  zkApp.claimantsRoot.get());
console.log('Built the claimants merkle tree. Setting claimants root to: ' +  claimantsRoot);

const txn = await Mina.transaction(zkAppAddress, () => {
  zkApp.setClaimantsRoot(claimantsRoot);
});

await txn.sign([zkAppKey]).send();

console.log('Updated claimants root: ' +  zkApp.claimantsRoot.get());
console.log('\n-- -- --\n');
console.log('Current claimant: ' + zkApp.claimant.get());
console.log('Alice attempting to claim...');

await claim('Alice');

console.log('Current claimant: ' + zkApp.claimant.get());
console.log('\n-- -- --\n');

console.log('Bob attempting to release (this should fail)...');

try { await release('Bob'); }
catch(e) { console.log('Yep it failed with error: ' + (e as Error).message); }

console.log('Current claimant (should be unchanged): ' + zkApp.claimant.get());
console.log('\n-- -- --\n');

console.log('Alive attempting to release (this should succeed)...');

await release('Alice');

console.log('Current claimant (should be 0): ' + zkApp.claimant.get());
console.log('\n-- -- --\n');