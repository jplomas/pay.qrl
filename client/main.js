global.Buffer = global.Buffer || require("buffer").Buffer

import './main.html'

Template.bodyContent.events({
  'click #submit-identity': () => {
    const id = document.getElementById('userId').value
    if (id.length > 0) {
      Meteor.call('submitIdentity', id, function (error, result) {
        console.log({error, result})
        if (!error) {
          document.getElementById('outputJson').textContent = result.hash
          document.getElementById('modal').classList.add('is-active');
        }
      });
    }
  }
})

Template.modal.events({
  'click .mc': () => {
    $('.modal').removeClass('is-active')
    $('html').removeClass('is-clipped')
  }
})