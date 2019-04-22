# clipbrdsvc

[Clipbrd](http://www.clipbrd.com/) is an Android app that sends copied text from your device to your PC and vice versa via a
Chrome browser extension. I find this very useful except I prefer to use Firefox and would rather not have to keep Chrome
running at all times for this one function.

This is a node port of the client that can run in the background, removing the
dependency on Chrome. I tried to use as much of the same client code as possible, which is found in the Chrome extension
directory. This project includes a service and a simple client to interact (sign in, enable, etc.) with it. The service can
run in the background using pm2 or forever.


### Instructions

0. Nodejs must already be installed on your PC and the clipbrd app must be installed on your phone
1. Clone this repository (git clone https://github.com/jgett/clipbrdsvc/)
1. cd clipbrdsvc
1. npm install
1. pm2 index.js
