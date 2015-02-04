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
      <div className="Login">
        <form className="Login-form">
          <div className="Login-input">
            <input className="form-control" ref="username" placeholder="Email"/>
          </div>
          <div className="Login-input">
            <input className="form-control" ref="password" placeholder="Password" type="password"/>
          </div>
          <div className="Login-actions">
            <div className="Login-actionsLeft">
              <div className="Login-remember">
                <input type="checkbox" ref="remember" id="remember"/>
                <label htmlFor="remember">Remember me</label>
              </div>
              <div className="Login-forgot">{this.renderForgotPasswordLink()}</div>
            </div>
            <div className="Login-actionsRight">
              {this.renderButton()}
            </div>
          </div>
          <div className="Login-error">{this.renderError()}</div>
        </form>
      </div>
    );
  },

  renderForgotPasswordLink: function() {
    return (
      <a href={window.app.api.makeBlipUrl('#/request-password-from-uploader')} target="_blank">
        {'Forgot your password?'}
      </a>
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
        className="Login-button"
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
      working: true,
      error: null
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

    return <span>{this.state.error}</span>;
  }
});

module.exports = Login;
