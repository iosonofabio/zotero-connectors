/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

var pos = (Zotero.isIE && document.compatMode === "BackCompat" ? "absolute" : "fixed");
var cssBookmarkletFrameDimmer = {"background":"black", "opacity":"0.5", "position":pos,
	"top":"0px", "bottom":"0px", "left":"0px", "right":"0px", "zIndex":"16777270",
	"height":"100%", "width":"100%", "filter":"alpha(opacity = 50);"};
var cssBookmarkletFrame = {"position":pos, "zIndex":"16777271", "top":"50%",
	"left":"50%", "background":"white"};

Zotero.isBookmarklet = true;
Zotero.initInject();
Zotero.Connector_Types.init();

/**
 * Creates a new frame with the specified width and height
 * @constructor
 */
var BookmarkletFrame = function(url, width, height) {
	this._appendTo = (document.body ? document.body : document.documentElement);
	
	// Make sure iframe is not bigger than window
	var windowWidth, windowHeight;
	if(window.innerWidth) {
		windowWidth = window.innerWidth;
		windowHeight = window.innerHeight;
	} else if(document.documentElement.offsetWidth) {
		windowWidth = document.documentElement.offsetWidth;
		windowHeight = document.documentElement.offsetHeight;
	} else if(document.body && document.body.offsetWidth) {
		windowWidth = document.body.offsetWidth;
		windowHeight = document.body.offsetHeight;
	} else {
		windowWidth = windowHeight = Infinity;
	}
	
	// Add width and height
	height = Math.min(windowHeight-10, height);
	width = Math.min(windowWidth-10, width);
	
	this._dimmer = document.createElement("div");
	this._dimmer.style.cssText = cssDivClearString;
	for(var i in cssBookmarkletFrameDimmer) this._dimmer.style[i] = cssBookmarkletFrameDimmer[i];
	this._appendTo.appendChild(this._dimmer);
	
	// Add iframe
	if(url) {
		this._frame = document.createElement("iframe");
		this._frame.src = url;
	} else {
		this._frame = zoteroIFrame;
	}
	for(var i in cssBookmarkletFrame) this._frame.style[i] = cssBookmarkletFrame[i];
	this._frame.style.display = "block";
	this._frame.style.margin = "-"+height/2+"px 0 0 -"+width/2+"px";
	this._frame.style.width = width+"px";
	this._frame.style.height = height+"px";
	if(url) this._appendTo.appendChild(this._frame);
}

/**
 * Removes the frame
 */
BookmarkletFrame.prototype.remove = function() {
	this._appendTo.removeChild(this._dimmer);
	if(this._frame == zoteroIFrame) {
		zoteroIFrame.style.display = "none";
	} else {
		this._appendTo.removeChild(this._frame);
	}
}

var translate = new Zotero.Translate.Web(),
	selectCallback, cancelled, haveItem;
translate.setDocument(document);
translate.setHandler("translators", function(obj, translators) {
	selectCallback = cancelled = haveItem = null;
	
	if(translators && translators.length) {
		if(translators[0].runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
			Zotero.ProgressWindow.changeHeadline("Saving Item...");
		} else {
			Zotero.ProgressWindow.changeHeadline("Saving via Zotero Standalone...");
		}
		
		translate.setTranslator(translators[0]);
		translate.translate();
	} else {
		Zotero.ProgressWindow.changeHeadline("Saving Failed");
		
		Zotero.ProgressWindow.showNoTranslatorError();
		Zotero.ProgressWindow.startCloseTimer(8000);
		zoteroIFrame.parentNode.removeChild(zoteroIFrame);
	}
});
translate.setHandler("select", function(obj, items, callback) {
	var frame = new BookmarkletFrame(ZOTERO_CONFIG.BOOKMARKLET_URL+"itemSelector.html#"
		+encodeURIComponent(JSON.stringify([null, items])), 600, 350);
	
	selectCallback = function(items) {
		frame.remove();
		callback(items);
	};
});
translate.setHandler("itemSaving", function(obj, item) {
	Zotero.ProgressWindow.itemSaving(Zotero.ItemTypes.getImageSrc(item.itemType),
		item);
});
translate.setHandler("itemDone", function(obj, dbItem, item) {
	haveItem = true;
	Zotero.ProgressWindow.itemDone(Zotero.ItemTypes.getImageSrc(item.itemType),
		item);
});
translate.setHandler("done", function(obj, returnValue) {
	if(returnValue && haveItem) {
		Zotero.ProgressWindow.startCloseTimer(2500);
	} else if(!cancelled) {
		Zotero.ProgressWindow.showError();
		Zotero.ProgressWindow.startCloseTimer(8000);
	}
	zoteroIFrame.parentNode.removeChild(zoteroIFrame);
});

// Add message listener for translate, so we don't call until the iframe is loaded
Zotero.Messaging.addMessageListener("translate", function(data, event) {
	Zotero.ProgressWindow.changeHeadline("Looking for Translators...");
	if(event.origin.substr(0, 6) === "https:" && ZOTERO_CONFIG.BOOKMARKLET_URL.substr(0, 5) === "http:") {
		ZOTERO_CONFIG.BOOKMARKLET_URL = "https:"+ZOTERO_CONFIG.BOOKMARKLET_URL.substr(5);
	}
	translate.getTranslators();
});
Zotero.Messaging.addMessageListener("selectDone", function(returnItems) {
	// if no items selected, close save dialog immediately
	if(!returnItems || Zotero.Utilities.isEmpty(returnItems)) {
		cancelled = true;
		Zotero.ProgressWindow.close();
	}
	selectCallback(returnItems);
});

// We use these for OAuth, so that we can load the OAuth pages in a child frame of the privileged
// iframe
var revealedFrame;
Zotero.Messaging.addMessageListener("revealZoteroIFrame", function() {
	if(revealedFrame) return;
	revealedFrame = new BookmarkletFrame(null, 800, 400);
});
Zotero.Messaging.addMessageListener("hideZoteroIFrame", function() {
	revealedFrame.remove();
});

// Expose zoteroShowProgressWindow and zoteroBookmarkletURL
if(Zotero.isIE && window.location.protocol === "http:") {
	ZOTERO_CONFIG.BOOKMARKLET_URL = ZOTERO_CONFIG.BOOKMARKLET_URL.replace("https", "http");
}
window.zoteroShowProgressWindow = function() {
	Zotero.ProgressWindow.show();
	Zotero.ProgressWindow.changeHeadline("Looking for Zotero Standalone...");
};
window.zoteroBookmarkletURL = ZOTERO_CONFIG.BOOKMARKLET_URL;