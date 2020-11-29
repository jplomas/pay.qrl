import './main.html'

global.Buffer = global.Buffer || require('buffer').Buffer // eslint-disable-line

let timerHandler = null

const checkIfPaymentMade = () => {
  Meteor.call('payment.received', document.getElementById('outputJson').textContent, (error, result) => {
    console.log({ error, result })
  })
}

Template.bodyContent.events({
  'click #submit-identity': () => {
    const id = document.getElementById('userId').value
    if (id.length > 0) {
      Meteor.call('submitIdentity', id, (error, result) => {
        console.log({ error, result })
        if (!error) {
          document.getElementById('outputJson').textContent = result.hash
          document.getElementById('modal').classList.add('is-active')
          timerHandler = Meteor.setInterval(() => {
            checkIfPaymentMade()
          }, 6000)
        }
      })
    }
  },
})

Template.modal.events({
  'click .mc': () => {
    $('.modal').removeClass('is-active')
    $('html').removeClass('is-clipped')
    Meteor.clearInterval(timerHandler)
  },
})
