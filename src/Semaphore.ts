import { 
    SmartContract, 
    state, 
    State, 
    method, 
    Bool,
    Field,
    Permissions
  } from 'o1js';

import { checkCredentials } from './Stub.js'
  
  export class Semaphore extends SmartContract {
    @state(Bool) claimed = State<Bool>();

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

      this.claimed.set(Bool(false));
      this.claimantsRoot.set(Field(0));
    }

    @method setClaimantsRoot(claimantsRoot: Field) {
        // this is not proven. authorized by signature
        this.requireSignature();
        this.claimantsRoot.set(claimantsRoot);
    }
  
    @method claim() {
      // race condition assertion dance
      const currentClaimed = this.claimed.get();
      this.claimed.assertEquals(currentClaimed);

      // must be unclaimed
      currentClaimed.assertFalse();

      // must have necessary credentials (TODO: currently stubbed)
      Bool(checkCredentials()).assertTrue();

      this.claimed.set(Bool(true));
    }
  }