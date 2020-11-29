import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import validate from '@theqrl/validate-qrl-address'
import _ from 'underscore'
import sha256 from 'sha256'
import QrlNode from './qrlNode'

const ip = 'testnet-2.automated.theqrl.org'
// const ipMainnet = 'mainnet-1.automated.theqrl.org'
const port = '19009'
const testnet = new QrlNode(ip, port)
// const mainnet = new QrlNode(ipMainnet, port)
const VENDOR_WALLET = 'Q01050038ca2264a06ee154a681201f99079bcd1ddf28355060b969daed25dd98efbf9ffd61b9b6'

let doneStartup = false
let vendorWalletTransactions = 0 // eslint-disable-line
let vendorWalletIncomingTransactions = []

// TODO
//
// * UI if network is down/not connected to QRL nodes
//

const getTx = (tx) => testnet.api('GetObject', { query: Buffer.from(tx, 'hex') }).then((res) => res)

const howManyTx = (addr) => testnet
  .api('GetOptimizedAddressState', { address: addr })
  .then((res) => parseInt(res.state.transaction_hash_count, 10))

const getAddrTx = (addr) => {
  const apiAddr = Buffer.from(addr.substring(1), 'hex')
  howManyTx(apiAddr).then((res) => {
    console.log(`Vendor wallet has ${res} transactions`)
    // check if this is greater than 'known' transactions
    if (res > vendorWalletTransactions) {
      // TO DO - logic if > 100
      testnet
        .api('GetMiniTransactionsByAddress', {
          address: apiAddr,
          item_per_page: 100,
          page_number: 1,
        })
        .then((tx) => {
          let incomingTx = 0
          vendorWalletIncomingTransactions = []
          _.each(tx.mini_transactions, (t) => {
            if (t.out === false) {
              incomingTx += 1
              vendorWalletIncomingTransactions.push(t.transaction_hash)
            }
          })
          console.log(`(of these Tx ${incomingTx} are incoming)`)
          console.log('hashes:')
          console.log(vendorWalletIncomingTransactions)
          // let transfersIn = 0
          _.each(vendorWalletIncomingTransactions, async (txD) => {
            const txDetail = await getTx(txD)
            if (txDetail.transaction.tx.transactionType === 'transfer') {
              // transfersIn += 1
              console.log(`Message: ${Buffer.from(txDetail.transaction.tx.transfer.message_data).toString()}`)
            }
          })
        })
    }
  })
}

const checkConnectionStatus = () => {
  if (testnet.connection === true) {
    console.log('Testnet is connected OKAY')
    if (!doneStartup) {
      getAddrTx(VENDOR_WALLET)
    }
  } else {
    console.log('ERROR: Testnet is not connected')
    testnet.connect()
  }
}

Meteor.startup(() => {
  testnet.connect().then(() => {
    console.log('Connection attempt to Testnet')
    console.log(`Testnet connection status: ${testnet.connection}`)
    if (testnet.connection) {
      doneStartup = true
      getAddrTx(VENDOR_WALLET)
    }
  })
  Meteor.setInterval(() => {
    checkConnectionStatus()
  }, 60000)

  Meteor.methods({
    submitIdentity(id) {
      check(id, String)
      if (validate.hexString(id).result) {
        const sha256Addresses = sha256(id + VENDOR_WALLET)
        return { message: 'GOOD ADDRESS', hash: sha256Addresses }
      }
      throw new Meteor.Error('Bad address')
    },
    'payment.received': function paymentReceived(id) {
      check(id, String)
      const apiAddr = Buffer.from(VENDOR_WALLET.substring(1), 'hex')
      howManyTx(apiAddr).then((currTx) => {
        console.log({ currTx })
        if (currTx > vendorWalletTransactions) {
          return 'maybe...'
        }
        return 'Not yet'
      })
    },
  })
})
