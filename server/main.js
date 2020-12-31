import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import validate from '@theqrl/validate-qrl-address'

import { Picker } from 'meteor/meteorhacks:picker'

import fs from 'fs'

import _ from 'underscore'
import sha256 from 'sha256'
import QrlNode from './qrlNode'

const ip = 'testnet-1.automated.theqrl.org'
// const ipMainnet = 'mainnet-1.automated.theqrl.org'
const port = '19009'
const node = new QrlNode(ip, port)
// const mainnet = new QrlNode(ipMainnet, port)
const VENDOR_WALLET = 'Q01050038ca2264a06ee154a681201f99079bcd1ddf28355060b969daed25dd98efbf9ffd61b9b6'
const PAYLOAD = 'QRL_whitepaper.pdf'

let doneStartup = false
let vendorWalletTransactions = 0 // eslint-disable-line
let vendorWalletIncomingTransactions = []

const valid = []

// TODO
//
// * check Tx is of sufficient value
//

const getTx = (tx) => node.api('GetObject', { query: Buffer.from(tx, 'hex') }).then((res) => res)

const howManyTx = (addr) => node
  .api('GetOptimizedAddressState', { address: addr })
  .then((res) => parseInt(res.state.transaction_hash_count, 10))

const getTxDetails = async () => {
  const output = []
  await _.each(vendorWalletIncomingTransactions, async (txD) => {
    const txDetail = await getTx(txD)
    if (txDetail.transaction.tx.transactionType === 'transfer') {
      output.push(txDetail)
    }
  })
  return output
}

const getAddrTx = (addr) => {
  const apiAddr = Buffer.from(addr.substring(1), 'hex')
  howManyTx(apiAddr).then((res) => {
    // check if this is greater than 'known' transactions
    if (res > vendorWalletTransactions) {
      // TO DO - logic if > 100
      node
        .api('GetMiniTransactionsByAddress', {
          address: apiAddr,
          item_per_page: 100,
          page_number: 1,
        })
        .then((tx) => {
          vendorWalletIncomingTransactions = []
          _.each(tx.mini_transactions, (t) => {
            if (t.out === false) {
              vendorWalletIncomingTransactions.push(t.transaction_hash)
            }
          })
        })
      getTxDetails()
      vendorWalletTransactions = res
    }
  })
}

const checkConnectionStatus = () => {
  if (node.connection === true) {
    console.log('Node is connected OKAY')
    if (!doneStartup) {
      getAddrTx(VENDOR_WALLET)
      doneStartup = true
    }
  } else {
    console.log('ERROR: Node is not connected')
    node.connect()
  }
}

Meteor.startup(() => {
  node.connect().then(() => {
    console.log('Connection attempt to Node')
    console.log(`Node connection status: ${node.connection}`)
    if (node.connection) {
      getAddrTx(VENDOR_WALLET)
      doneStartup = true
    }
  })
  Meteor.setInterval(() => {
    checkConnectionStatus()
  }, 60000)

  Picker.route('/download', (params, req, res) => {
    const { id } = params.query
    if (!doneStartup) {
      throw new Meteor.Error('Startup of server not yet complete: try again later.')
    }
    let alreadyValid = false
    _.each(valid, (validTx) => {
      if (validTx === id) {
        alreadyValid = true
      }
    })
    if (alreadyValid) {
      console.log(`Download request with an id that matches a Tx: ${id}`)
      const pdfData = fs.readFileSync(Assets.absoluteFilePath(PAYLOAD))
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=payload.pdf',
      })
      res.end(pdfData)
    } else {
      res.writeHead(500)
      res.end('Not authorised.')
    }
  })

  Meteor.methods({
    submitIdentity(id) {
      check(id, String)
      console.log({ doneStartup })
      if (!doneStartup) {
        throw new Meteor.Error('Startup of server not yet complete: try again later.')
      }
      if (validate.hexString(id).result) {
        const sha256Addresses = sha256(id + VENDOR_WALLET)
        return { message: 'GOOD ADDRESS', hash: sha256Addresses }
      }
      throw new Meteor.Error('Bad address')
    },
    'payment.received': function paymentReceived(id) {
      check(id, String)
      if (!doneStartup) {
        throw new Meteor.Error('Startup of server not yet complete: try again later.')
      }
      let alreadyValid = false
      _.each(valid, (validTx) => {
        if (validTx === id) {
          alreadyValid = true
        }
      })
      if (alreadyValid) {
        return 'Yes'
      }
      const apiAddr = Buffer.from(VENDOR_WALLET.substring(1), 'hex')
      return howManyTx(apiAddr).then(async (currTx) => {
        if (currTx > vendorWalletTransactions) {
          vendorWalletTransactions = currTx
          const oldTx = vendorWalletIncomingTransactions
          getAddrTx(VENDOR_WALLET)
          console.log({ vendorWalletIncomingTransactions, oldTx })
          const toCheck = _.without(vendorWalletIncomingTransactions, oldTx)
          console.log({ toCheck })
          if (toCheck.length > 0) {
            _.each(toCheck, async (txD) => {
              const txDetail = await getTx(txD)
              if (txDetail.transaction.tx.transactionType === 'transfer') {
                if (Buffer.from(txDetail.transaction.tx.transfer.message_data).toString() === id) {
                  valid.push(id)
                }
              }
            })
          }
          return 'No'
        }
        vendorWalletTransactions = currTx
        return 'No'
      })
    },
  })
})
