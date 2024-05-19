import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js"
import { MAINNET_PROGRAM_ID, LIQUIDITY_STATE_LAYOUT_V4, publicKey } from "@raydium-io/raydium-sdk"
import { NATIVE_MINT, createFreezeAccountInstruction, freezeAccount, getAssociatedTokenAddress } from "@solana/spl-token"
import base58 from "bs58"
import { COMMITMENT_LEVEL, MAIN_KP, MINT, RPC } from "./consts"
import { readJson, saveDataToFile } from "./utils"

let instructions: TransactionInstruction[] = []

const connection = new Connection(RPC)
const walletPks = readJson("bots.json")
const wallets: PublicKey[] = []
const tokenMint = new PublicKey(MINT)
const mainKp = Keypair.fromSecretKey(base58.decode(MAIN_KP))

const runListener = async () => {

  const runTimestamp = Math.floor(new Date().getTime() / 1000)
  const raydiumSubscriptionId = connection.onProgramAccountChange(
    MAINNET_PROGRAM_ID.AmmV4,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString()
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data)
      const poolOpenTime = parseInt(poolState.poolOpenTime.toString())
      const quoteVault = poolState.quoteVault

      if (poolOpenTime > runTimestamp) {
        console.log("Pool created")
        trackWallets(connection, quoteVault)
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
          bytes: tokenMint.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
          bytes: NATIVE_MINT.toBase58(),
        },
      },

      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
          bytes: MAINNET_PROGRAM_ID.AmmV4.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
          bytes: base58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
        },
      },
    ],
  )

  console.log('----------------------------------------')
  console.log('Bot is listening for buying wallets')
  console.log('----------------------------------------')
}

async function trackWallets(connection: Connection, quoteVault: PublicKey): Promise<void> {

  const initialWsolBal = (await connection.getTokenAccountBalance(quoteVault)).value.uiAmount
  if (!initialWsolBal) {
    console.log("Quote vault mismatch")
    return
  }
  try {
    connection.onLogs(
      quoteVault,
      async ({ logs, err, signature }) => {
        if (err) { }
        else {
          const parsedData = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
          const signer = parsedData?.transaction.message.accountKeys.filter((elem: any) => {
            return elem.signer == true
          })[0].pubkey.toBase58()

          // console.log(`\nTransaction success: https://solscan.io/tx/${signature}\n`)
          if (!walletPks.includes(signer!)) {
            saveDataToFile([signer!])
            const user = new PublicKey(signer!)
            console.log(`Wallet ${signer} has bought`)
            wallets.push(user)
            const ata = await getAssociatedTokenAddress(tokenMint, user)


            instructions.push(createFreezeAccountInstruction(ata, tokenMint, mainKp.publicKey))

            if(instructions.length == 5){
              const transaction = new Transaction().add(...instructions);
              instructions = []
              const sig = await sendAndConfirmTransaction(connection, transaction, [mainKp]);
              console.log(`https://solscan.io/tx/${sig}`)
            }
          }
        }
      },
      "confirmed"
    );
  } catch (error) {
  console.log("error:", error)
  }
}

// runListener()

const test = async () => {
  const ata = await getAssociatedTokenAddress(tokenMint, new PublicKey("EfByndQ4Q9TGcgdd26etGhwqq4v2XfAW3VrfkP32z19d"))
  instructions.push(createFreezeAccountInstruction(ata, tokenMint, mainKp.publicKey))
  const transaction = new Transaction().add(...instructions);

  const sig = await sendAndConfirmTransaction(connection, transaction, [mainKp]);
  console.log(`https://solscan.io/tx/${sig}`)
}

test()