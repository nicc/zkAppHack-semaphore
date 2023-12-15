import {
  Poseidon,
  Field,
  PublicKey,
  Struct,
  MerkleWitness
} from 'o1js';

export class ClaimantAccount extends Struct({ publicKey: PublicKey}) {
  hash(): Field {
    return Poseidon.hash(ClaimantAccount.toFields(this));
  }
}

export class ClaimantMerkleWitness extends MerkleWitness(8) {}