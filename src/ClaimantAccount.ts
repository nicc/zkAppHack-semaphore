import {
  Poseidon,
  Field,
  PublicKey,
  Struct,
} from 'o1js';

export class ClaimantAccount extends Struct({ publicKey: PublicKey }) {
  hash(): Field {
    return Poseidon.hash(ClaimantAccount.toFields(this));
  }
}