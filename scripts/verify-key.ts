// Verifies the private key in .env derives to the expected deployer address
// AND has enough balance on Kasplex mainnet to deploy. Never prints the key.

import { ethers } from 'hardhat';

const EXPECTED = '0xAd7991700167FebC845fc70ADf16eC7fC866052B';
const MIN_BAL_KAS = 8;

async function main() {
  const [d] = await ethers.getSigners();
  const net = await d.provider!.getNetwork();
  const bal = await d.provider!.getBalance(d.address);
  const balKas = Number(ethers.formatEther(bal));

  const addrMatch = d.address.toLowerCase() === EXPECTED.toLowerCase();
  const enoughBal = balKas >= MIN_BAL_KAS;

  console.log('Chain:           ', Number(net.chainId), Number(net.chainId) === 202555 ? '(Kasplex mainnet ✓)' : '(unexpected)');
  console.log('Derived address: ', d.address);
  console.log('Expected:        ', EXPECTED);
  console.log('Address match:   ', addrMatch ? '✓ YES' : '✗ NO');
  console.log('Balance:         ', balKas, 'KAS');
  console.log('Enough for deploy:', enoughBal ? '✓ YES (need ~7.6)' : '✗ NO');

  if (!addrMatch) {
    console.error('\n❌ The key in .env does NOT derive to', EXPECTED);
    console.error('   Either you exported the wrong account, or the key was truncated.');
    process.exit(1);
  }
  if (!enoughBal) {
    console.error('\n❌ Balance too low');
    process.exit(1);
  }
  console.log('\n✅ Ready to deploy.');
}

main().catch(e => { console.error(e); process.exit(1); });
