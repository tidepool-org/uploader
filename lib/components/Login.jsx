/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var React = require('react');

var config = require('../config');

var Login = React.createClass({
  propTypes: {
    onLogin: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      working: false,
      error: null
    };
  },

  render: function() {
    return (
      <div>
        {this.renderSignupLink()}
        <form>
          <p><input className="form-control" ref="username" placeholder="Email"/></p>
          <p><input className="form-control" ref="password" placeholder="Password" type="password"/></p>
          <p>
            <input type="checkbox" ref="remember" id="remember"/>
            <label htmlFor="remember">{' Remember me'}</label>
          </p>
          {this.renderForgotPasswordLink()}
          <p>{this.renderButton()}</p>
        </form>
        {this.renderError()}
      </div>
    );
  },

  renderSignupLink: function() {
    return (
      <p>
        <a href={config.BLIP_URL + '#/signup'} target="_blank">Sign up</a>
      </p>
    );
  },

  renderForgotPasswordLink: function() {
    return (
      <p>
        <a href={config.BLIP_URL + '#/request-password-reset'} target="_blank">
          {'Forgot your password?'}
        </a>
      </p>
    );
  },

  renderButton: function() {
    var disabled;
    var text = 'Login';

    if (this.state.working) {
      disabled = true;
      text = 'Logging in...';
    }

    return (
      <button
        type="submit"
        onClick={this.handleLogin}
        disabled={disabled}>
        {text}
      </button>
    );
  },

  handleLogin: function(e) {
    e.preventDefault();
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    var remember = this.refs.remember.getDOMNode().checked;

    this.setState({
      working: true
    });
    var self = this;
    this.props.onLogin({
      username: username,
      password: password
    }, {remember: remember}, function(err) {
      if (err) {
        self.setState({
          working: false,
          error: 'Wrong username or password.'
        });
        return;
      }
    });
  },

  renderError: function() {
    if (!this.state.error) {
      return null;
    }

    return <p style={{color: 'red'}}>{this.state.error}</p>;
  }
});

module.exports = Login;
