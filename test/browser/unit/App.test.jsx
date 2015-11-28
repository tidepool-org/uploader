var React = require('react');
var TestUtils = require('react-addons-test-utils');
var expect = chai.expect;

window.config = {};
var App = require('../../../lib/components/App.jsx');

describe('App', function() {
  describe('render', function() {
    it('should render without problems', function() {
      var elem = TestUtils.renderIntoDocument(<App />);
      expect(elem).to.be.ok;
    }); 
  });
});