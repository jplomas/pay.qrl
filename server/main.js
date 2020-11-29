import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import validate from '@theqrl/validate-qrl-address'
import QrlNode from './qrlNode'
import _ from 'underscore'
import sha256 from 'sha256'

const ip = 'testnet-1.automated.theqrl.org'
const ip_mainnet = 'mainnet-1.automated.theqrl.org'
const port = '19009'
const testnet = new QrlNode(ip, port)
const mainnet = new QrlNode(ip_mainnet, port)
const VENDOR_WALLET = 'Q01050038ca2264a06ee154a681201f99079bcd1ddf28355060b969daed25dd98efbf9ffd61b9b6'

let vendorWalletTransactions = 0
let vendorWalletIncomingTransactions = []

const checkConnectionStatus = () => {
  if (testnet.connection === true) {
    console.log('Testnet is connected OKAY')
  } else {
    console.log('ERROR: Testnet is not connected')
  }
}

const getTx = (tx) => {
  return testnet.api('GetObject', { query: Buffer.from(tx, 'hex') }).then(res => {
    return res
  })
}

const getAddrTx = (addr) => {
  const apiAddr = Buffer.from(addr.substring(1), 'hex')
  testnet.api('GetOptimizedAddressState', { address: apiAddr }).then((res) => {
    console.log('Vendor wallet has ' + res.state.transaction_hash_count + ' transactions')
    // check if this is greater than 'known' transactions
    if (res.state.transaction_hash_count > vendorWalletTransactions) {
      // TO DO - logic if > 100
      testnet.api('GetMiniTransactionsByAddress', {
        address: apiAddr,
        item_per_page: 100,
        page_number: 1
      }).then((tx) => {
        let incomingTx = 0
        vendorWalletIncomingTransactions = []
        _.each(tx.mini_transactions, t => {
          if (t.out === false) {
            incomingTx += 1
            vendorWalletIncomingTransactions.push(t.transaction_hash)
          }
        })
        console.log('(of these Tx ' + incomingTx + ' are incoming)')
        console.log('hashes:')
        console.log(vendorWalletIncomingTransactions)
        let transfersIn = 0
        _.each(vendorWalletIncomingTransactions, async (tx) => {
          const txDetail = await getTx(tx)
          if (txDetail.transaction.tx.transactionType === 'transfer') {
            transfersIn += 1
            console.log('Message: ' + Buffer.from(txDetail.transaction.tx.transfer.message_data).toString('hex'))
          }
        })
        // console.log('There were ' + transfersIn + ' transfers in')
      })
    }
  })
}

Meteor.startup(() => {
  testnet.connect().then(() => {
    console.log('Connection attempt to Testnet')
    console.log('Testnet connection status: ' + testnet.connection)
    getAddrTx(VENDOR_WALLET)
  });
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
      }
    })

})
