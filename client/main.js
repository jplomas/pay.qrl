import './main.html'

global.Buffer = global.Buffer || require('buffer').Buffer // eslint-disable-line

let timerHandler = null

const checkIfPaymentMade = () => {
  Meteor.call('payment.received', document.getElementById('outputJson').textContent, (error, result) => {
    if (result === 'Yes') {
      console.log({ error, result })
      document.location = `/download?id=${document.getElementById('outputJson').textContent}`
    }
  })
}

Template.bodyContent.events({
  'click #submit-identity': () => {
    const id = document.getElementById('userId').value
    if (id.length > 0) {
      Meteor.call('submitIdentity', id, (error, result) => {
        console.log({ error, result })
        if (error) {
          document.getElementById('errorText').textContent = error.error
          document.getElementById('errorModal').classList.add('is-active')
        }
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

Template.errorModal.events({
  'click .mc': () => {
    $('.modal').removeClass('is-active')
    $('html').removeClass('is-clipped')
  },
})
