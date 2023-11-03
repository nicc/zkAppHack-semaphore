import { Semaphore } from './Semaphore';
import { Mina, PrivateKey, PublicKey, AccountUpdate, Bool } from 'o1js';

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

  });
});
