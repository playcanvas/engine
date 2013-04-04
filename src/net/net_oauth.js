pc.extend(pc.net, function () {
    var refreshCounter = 0;
    
    var OAuth = function OAuth(endpoint, redirectUrl, origin, clientId, scope) {
        this.clientId = clientId;
        this.endpoint = endpoint;
        this.redirectUrl = redirectUrl;
        this.origin = origin;
        this.scope = scope;
        this.responseType = "token";
        this.accessToken = null;

        // Base string for iframe element id
        this.OAUTH_IFRAME_ID_BASE = "pc-oauth-access-token-";

        //this._refreshCounter = 0;
    };
    OAuth = pc.inherits(OAuth, pc.net.Http);

    OAuth.prototype.refreshAccessToken = function (success) {
        var id = this.OAUTH_IFRAME_ID_BASE + refreshCounter++;
        
        // Create a message handler to receive message from iframe.
        var handleMessage = function handleMessage (msg) {
            if (msg.origin !== this.origin) {
                return;
            }
                
            if (msg.data.access_token) {
                var iframe = document.getElementById(id);
                if(iframe) {
                    iframe.parentNode.removeChild(iframe);
                }
                this.accessToken = msg.data.access_token;
                success(msg.data.access_token);
            } else {
                if (msg.data.error) {
                    logERROR(msg.data.error);
                } else {
                    logWARNING("Invalid message posted to Corazon API");
                }
            }
            
            clearEvent();
        }.bind(this);
        window.addEventListener("message", handleMessage, false);
        var clearEvent = function () {
            window.removeEventListener("message", handleMessage);
        };
    
        // Create the endpoint url
        var params = {
            client_id: this.clientId,
            redirect_url: this.redirectUrl,
            scope: this.scope,
            response_type: this.responseType
        };
        
        var url = new pc.URI(this.endpoint);
        url.setQuery(params);

        var iframe = document.getElementById(id);
        if (iframe) {
            throw new Error("accessToken request already in progress");
        }
        iframe = document.createElement("iframe");
        iframe.src = url.toString();
        iframe.id = id;
        iframe.style.display = "none";
        document.body.appendChild(iframe);
    };
    
    OAuth.prototype.request = function (method, url, options, xhr) {
        options.query = options.query || {};
        options.query = pc.extend(options.query, {
            "access_token": this.accessToken
        });
        
        return pc.net.OAuth._super.request.call(this, method, url, options, xhr);
    };
    
    OAuth.prototype.onError = function (method, url, options, xhr) {
        if (xhr.status == 401) {
            // Get a new access token and resend the request
            this.refreshAccessToken(function (accessToken) {
                options.query.access_token = accessToken;
                this.request(method, url, options, xhr);    
            }.bind(this));
        } else {
            options.error(xhr.status, xhr, null);    
        }
            
    };
    
    return {
        OAuth: OAuth,
        oauth: new OAuth()
    };
}());

