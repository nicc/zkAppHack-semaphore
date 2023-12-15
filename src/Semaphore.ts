import { 
    SmartContract, 
    state, 
    State, 
    method,
    Field,
    Permissions,
  } from 'o1js';

import { ClaimantAccount, ClaimantMerkleWitness } from './ClaimantAccount.js';
  
  export class Semaphore extends SmartContract {
    // the merkle root for the valid set of claimants
    @state(Field) claimantsRoot = State<Field>(); 

    // the merkle witness for the current claimant
    @state(Field) claimant = State<Field>(); 
  
    init() {
      super.init();
      this.account.permissions.set({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
      });

      this.claimantsRoot.set(Field(0));
      this.claimant.set(Field(0));
    }

    @method setClaimantsRoot(claimantsRoot: Field) {
        // this is not proven. authorized by signature
        this.requireSignature();
        this.claimantsRoot.set(claimantsRoot);
    }

    @method claim(claimantPath: ClaimantMerkleWitness) {
      const currentClaimant = this.claimant.getAndAssertEquals();
      const currentClaimantsRoot = this.claimantsRoot.getAndAssertEquals();

      // can only act on behalf of yourself
      const account = new ClaimantAccount({publicKey: this.sender});

      // must be unclaimed
      currentClaimant.assertEquals(Field(0));

      // must be allowed to claim
      claimantPath.calculateRoot(account.hash()).assertEquals(currentClaimantsRoot)

      // okay let's do it
      this.claimant.set(account.hash());
    }
  
    @method release() {
      const currentClaimant = this.claimant.getAndAssertEquals();

      // can only act on behalf of yourself
      const account = new ClaimantAccount({publicKey: this.sender});

      // must be the claimant to release
      currentClaimant.assertEquals(account.hash())

      // okay let's do it
      this.claimant.set(Field(0));
    }
  }