import React, { Component } from "react";
import { UserSession, AppConfig, Person } from "blockstack";
import Unity, { UnityContent } from "react-unity-webgl";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig: appConfig });
const unityContainerStyle = {
  width: "800px",
  widthValue: 800,
  height: "480px",
  heightValue: 480
};

export default class App extends Component {
  resized = false;

  constructor(props) {
    super(props);
    this.unityContent = new UnityContent(
      "Build/Apollos WebGL Build.json",
      "Build/UnityLoader.js",
      { adjustOnWindowResize: true }
    );

    this.unityContent.on("progress", progress => {
      try {
        this.unityProgress(progress);
      } catch (error) {
        console.log("Error in event->on.progress; Reason: " + error);
      }
    });

    this.unityContent.on("Login", () => {
      try {
        this.handleSignIn();
      } catch (error) {
        console.log("Error in event->on.Login; Reason: " + error);
      }
    });

    this.unityContent.on("IsLoggedIn", () => {
      try {
        if (userSession.isUserSignedIn()) {
          this.sendUserData();
        } else if (userSession.isSignInPending()) {
          userSession
            .handlePendingSignIn()
            .then(userData => {
              this.sendUserData();
            })
            .catch(err => {
              console.log("Error in event->on.IsLoggedIn; Reason: " + err);
              if (err.message.includes("Existing user session")) {
                this.sendUserData();
              } else {
                this.unityContent.send("UI", "OnUserNotLoggedIn");
              }
            });
        } else {
          this.unityContent.send("UI", "OnUserNotLoggedIn");
        }
      } catch (error) {
        console.log(
          "Error in event->on.IsLoggedIn outer catch block; Reason: " + error
        );
      }
    });

    this.unityContent.on("Logout", () => {
      try {
        userSession.signUserOut();
      } catch (error) {
        console.log("Error in event->on.Logout; Reason: " + error);
      }
    });

    this.unityContent.on("SavePlayerData", data => {
      try {
        if (
          userSession !== undefined &&
          userSession !== null &&
          userSession.isUserSignedIn &&
          !userSession.isSignInPending()
        ) {
          if (data !== undefined && data !== null) {
            const options = { encrypt: false };
            userSession.putFile("apollos_player_data.json", data, options);
          }
        }
      } catch (error) {
        console.log("Error in event->on.SavePlayerData; Reason: " + error);
      }
    });

    this.unityContent.on("RequestPlayerData", () => {
      try {
        if (
          userSession !== undefined &&
          userSession !== null &&
          userSession.isUserSignedIn
        ) {
          const options = { decrypt: false };
          userSession
            .getFile("apollos_player_data.json", options)
            .then(file => {
              try {
                var playerData = JSON.parse(file || "");
                var playerDataString = JSON.stringify(playerData);
                this.unityContent.send(
                  "UI",
                  "ReceivePlayerData",
                  playerDataString
                );
              } catch (error) {
                console.log(
                  "Error in event->on.RequestPlayerData.getFile.then; Reason: " +
                    error
                );
                this.unityContent.send("UI", "ReceivePlayerData", "");
              }
            })
            .catch(error => {
              console.log(
                "Error in event->on.RequestPlayerData.getFile promise; Reason: " +
                  error
              );
              this.unityContent.send("UI", "ReceivePlayerData", "");
            });
        }
      } catch (error) {
        console.log(
          "Error in event->on.RequestPlayerData outer catch block; Reason: " +
            error
        );
      }
    });
  }

  handleSignIn() {
    try {
      if (userSession.isUserSignedIn()) {
        this.sendUserData();
      } else if (userSession.isSignInPending()) {
        userSession
          .handlePendingSignIn()
          .then(userData => {
            this.sendUserData(userData);
          })
          .catch(err => {
            console.log(
              "Error in handleSignIn->handlePendingSignIn promise; Reason: " +
                err
            );
            userSession.signUserOut();
            userSession.redirectToSignIn();
          });
      } else {
        userSession.signUserOut();
        userSession.redirectToSignIn();
      }
    } catch (error) {
      console.log("Error in handleSignIn outer catch block; Reason: " + error);
    }
  }

  unityProgress(progress) {
    const unityInstance = this.unityContent.unityInstance;
    if (!unityInstance.Module) return;
    if (!unityInstance.logo) {
      unityInstance.logo = document.createElement("div");
      unityInstance.logo.className =
        "logo " + unityInstance.Module.splashScreenStyle;
      unityInstance.container.appendChild(unityInstance.logo);
    }
    if (!unityInstance.progress) {
      unityInstance.progress = document.createElement("div");
      unityInstance.progress.className =
        "progress " + unityInstance.Module.splashScreenStyle;
      unityInstance.progress.empty = document.createElement("div");
      unityInstance.progress.empty.className = "empty";
      unityInstance.progress.appendChild(unityInstance.progress.empty);
      unityInstance.progress.full = document.createElement("div");
      unityInstance.progress.full.className = "full";
      unityInstance.progress.appendChild(unityInstance.progress.full);
      unityInstance.container.appendChild(unityInstance.progress);
    }
    unityInstance.progress.empty.style.width = 100 * progress + "%";
    unityInstance.progress.full.style.width = 100 * (1 - progress) + "%";
    if (progress === 1)
      unityInstance.logo.style.display = unityInstance.progress.style.display =
        "none";
    if (!this.resized) {
      this.resizeWindow();
      this.resized = true;
    }
  }

  sendUserData(userData) {
    try {
      if (userData === undefined) {
        userData = userSession.loadUserData();
      }
      if (userData !== undefined) {
        var person = new Person(userData.profile);
        var username = userData.username;
        var givenname = person.givenName();
        var name = "Anonymous";
        if (username !== undefined && username != null && username !== "") {
          name = username;
        } else if (
          givenname !== undefined &&
          givenname != null &&
          givenname !== ""
        ) {
          name = givenname;
        }
        var avatar = "";
        var avatarUrl = person.avatarUrl();
        if (avatarUrl !== null && avatarUrl !== undefined && avatarUrl !== "") {
          avatar = avatarUrl;
        }
        var dataToSend = name + ";" + avatar;
        this.unityContent.send("UI", "OnUserLoggedIn", dataToSend);
      } else {
        alert("Unable to get login information. Try again later.");
        userSession.signUserOut();
      }
    } catch (error) {
      userSession.signUserOut();
      console.log("Error in sendUserData; Reason: " + error);
    }
  }

  handleSignOut() {
    try {
      userSession.signUserOut(window.location.origin);
    } catch (error) {
      console.log("Error in handleSignOut; Reason: " + error);
    }
  }

  setFullScreen() {
    try {
      this.unityContent.unityInstance.SetFullscreen(1);
    } catch (err) {
      console.log("Error in setFullScreen; Reason: " + err);
    }
  }

  resizeWindow() {
    var scaleToFit = true;
    var gameInstance = this.unityContent.unityInstance;
    var canvas = gameInstance.Module.canvas;
    var container = gameInstance.container;
    var w;
    var h;

    if (scaleToFit) {
      w = window.innerWidth;
      h = window.innerHeight;

      var r = unityContainerStyle.heightValue / unityContainerStyle.widthValue;

      if (w * r > window.innerHeight) {
        w = Math.min(w, Math.ceil(h / r));
      }
      h = Math.floor(w * r);
    } else {
      w = unityContainerStyle.widthValue;
      h = unityContainerStyle.heightValue;
    }
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.style.width = w + "px";
    container.style.height = h + "px";
    container.style.top = Math.floor((window.innerHeight - h) / 4) + "px";
    container.style.left = Math.floor((window.innerWidth - w) / 4) + "px";
  }

  componentDidMount() {
    window.onresize = this.resizeWindow.bind(this);
  }

  render() {
    return (
      <div className="webgl-content">
        <Unity
          unityContent={this.unityContent}
          width={unityContainerStyle.width}
          height={unityContainerStyle.height}
          className="unityContainer"
        />
      </div>
    );
  }
}
