import { 
    SmartContract, 
    state, 
    State, 
    method, 
    Bool
  } from 'o1js';
  
  export class Semaphore extends SmartContract {
    @state(Bool) claimed = State<Bool>();
  
    init() {
      super.init();
      this.claimed.set(Bool(false));
    }
  
    @method claim() {
      // race condition assertion dance
      const currentClaimed = this.claimed.get();
      this.claimed.assertEquals(currentClaimed);

      // must be unclaimed
      currentClaimed.assertFalse();

      this.claimed.set(Bool(true));
    }
  }