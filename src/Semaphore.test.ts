import { Semaphore } from './Semaphore';
import { Mina, PrivateKey, PublicKey, AccountUpdate, Bool, Field } from 'o1js';

let proofsEnabled = false;

describe('Semaphore.js', () => {
  describe('Semaphore()', () => {
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      senderAccount: PublicKey,
      senderKey: PrivateKey,
      zkAppAddress: PublicKey,
      zkAppPrivateKey: PrivateKey,
      zkApp: Semaphore;

    beforeAll(async () => {
      if (proofsEnabled) await Semaphore.compile();
    });

    beforeEach(() => {
      const Local = Mina.LocalBlockchain({ proofsEnabled });
      Mina.setActiveInstance(Local);
      ({ privateKey: deployerKey, publicKey: deployerAccount } =
        Local.testAccounts[0]);
      ({ privateKey: senderKey, publicKey: senderAccount } =
        Local.testAccounts[1]);
      zkAppPrivateKey = PrivateKey.random();
      zkAppAddress = zkAppPrivateKey.toPublicKey();
      zkApp = new Semaphore(zkAppAddress);
    });

    async function localDeploy() {
      const txn = await Mina.transaction(deployerAccount, () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        zkApp.deploy();
      });
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }

    it('deploys and inits the smart contract', async () => {
      await localDeploy();
      const num = zkApp.claimed.get();
      expect(num).toEqual(Bool(false));
    });

    it('is claimable', async () => {
      await localDeploy();
  
      // update transaction
      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.claim();
      });
      await txn.prove();
      await txn.sign([senderKey]).send();
  
      const updatedClaimed = zkApp.claimed.get();
      expect(updatedClaimed).toEqual(Bool(true));
    });

    it('allows account owner to register valid claimants', async () => {
      await localDeploy();

      const originalClaimantsRoot = zkApp.claimantsRoot.get();
      const newClaimantsRoot = Field(22);
  
      // update transaction
      const txn = await Mina.transaction(zkAppAddress, () => {
        zkApp.setClaimantsRoot(newClaimantsRoot);
      });
      
      await txn.sign([zkAppPrivateKey]).send();
  
      const updatedClaimantsRoot = zkApp.claimantsRoot.get();
      
      expect(updatedClaimantsRoot).toEqual(newClaimantsRoot);
      expect(updatedClaimantsRoot).not.toEqual(originalClaimantsRoot);
    });

    it('does not allow anyone other than account owner to register valid claimants', async () => {
      await localDeploy();

      const newClaimantsRoot = Field(22);
  
      // update transaction
      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.setClaimantsRoot(newClaimantsRoot);
      });
      
      await txn.prove();

      // annoying workaround for expect().toThrow not working. Didn't want to get stuck here
      let errorMsg = "";
      try {
        await txn.sign([senderKey]).send(); 
      } catch(e: unknown) {
        if (e instanceof Error) errorMsg = e.message
      }
        
      expect(errorMsg).toMatch("Check signature: Invalid signature on account_update");
    });

  });
});
