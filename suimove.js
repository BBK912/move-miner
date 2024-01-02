const { getFullnodeUrl, SuiClient } = require('@mysten/sui.js/client');
const { MIST_PER_SUI } = require('@mysten/sui.js/utils');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { Ed25519Keypair, Ed25519PublicKey } = require('@mysten/sui.js/keypairs/ed25519');
const { fromHEX }  = require('@mysten/sui.js/utils');

const secretKey = ""; // 修改这里，填入私钥
const PACKAGE_ID = "0x830fe26674dc638af7c3d84030e2575f44a2bdc1baa1f4757cfe010a4b106b6a"; // mainnet
const TickRecordID = "0xfa6f8ab30f91a3ca6f969d117677fb4f669e08bbeed815071cf38f4d19284199"; // mainnet
const MINT_FEE = 100000000; // 0.1 SUI
const TICK = "MOVE";

// Keypair from an existing secret key (Uint8Array)
const keypair = Ed25519Keypair.fromSecretKey(fromHEX(secretKey));
const publickey = new Ed25519PublicKey(keypair.getPublicKey().toRawBytes());
const MY_ADDRESS = publickey.toSuiAddress();
console.log(`My address: ${MY_ADDRESS}`);

// create a new SuiClient object pointing to the network you want to use
const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function get_current_epoch(suiClient) {
    const tick_record = await suiClient.getObject({
        id: TickRecordID,
        options: { showContent: true, showDisplay: true },
    })
    return parseInt(tick_record.data.content.fields.current_epoch);
}

let latest_epoch = -1;

async function executeTransaction() {
    while (true) {
        let current_epoch = await get_current_epoch(suiClient);
        if (latest_epoch == current_epoch) {
            await sleep(10 * 1000); // 10 seconds
            continue;
        }
        latest_epoch = current_epoch;
        const txb = new TransactionBlock();
        const [coin] = txb.splitCoins(txb.gas, [MINT_FEE]);
        txb.moveCall({
            target: `${PACKAGE_ID}::movescription::mint`,
            // object IDs must be wrapped in moveCall arguments
            arguments: [
                txb.object(TickRecordID),
                txb.pure(TICK),
                coin,
                txb.pure("0x6")],
        });
        const result = await suiClient.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer: keypair,
        });

        const transactionBlock = await suiClient.waitForTransactionBlock({
            digest: result.digest,
            options: {
                showEffects: true,
            },
        });
        console.log(`current epoch: ${current_epoch}`);
    }
}
executeTransaction();
