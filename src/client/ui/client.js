// Copyright (c) 2012 Titanium I.T. LLC. All rights reserved. See LICENSE.txt for details.
/*global Raphael, $ */

(function() {
	"use strict";

	var SvgCanvas = require("./svg_canvas.js");
	var HtmlElement = require("./html_element.js");
	var HtmlCoordinate = require("./html_coordinate.js");
	var browser = require("./browser.js");
	var failFast = require("fail_fast");
	var ClientDrawEvent = require("../../shared/client_draw_event.js");
	var ServerDrawEvent = require("../../shared/server_draw_event.js");
	var ClientPointerEvent = require("../../shared/client_pointer_event.js");
	var ServerPointerEvent = require("../../shared/server_pointer_event.js");
	var ClientClearScreenEvent = require("../../shared/client_clear_screen_event.js");
	var ServerClearScreenEvent = require("../../shared/server_clear_screen_event.js");

	var svgCanvas = null;
	var start = null;
	var lineDrawn = false;
	var drawingArea;
	var clearScreenButton;
	var pointerHtml;
	var documentBody;
	var windowElement;
	var network;
	var eventIds;

	exports.initializeDrawingArea = function(elements, realTimeConnection) {
		if (svgCanvas !== null) throw new Error("Client.js is not re-entrant");

		drawingArea = elements.drawingAreaDiv;
		clearScreenButton = elements.clearScreenButton;
		pointerHtml = elements.pointerHtml;

		failFast.unlessDefined(drawingArea, "elements.drawingArea");
		failFast.unlessDefined(clearScreenButton, "elements.clearScreenButton");
		failFast.unlessDefined(pointerHtml, "elements.pointerHtml");

		documentBody = new HtmlElement(document.body);
		windowElement = new HtmlElement(window);
		svgCanvas = new SvgCanvas(drawingArea);
		network = realTimeConnection;
		eventIds = {};

		network.connect(window.location.port);

		handlePointerMovement();
		handleClearScreenAction();
		handleDrawing();

		return svgCanvas;
	};

	exports.drawingAreaHasBeenRemovedFromDom = function() {
		svgCanvas = null;
	};


	//*** Pointers

	function handlePointerMovement() {
		documentBody.onMouseMove(sendPointerEvent);
		network.onEvent(ServerPointerEvent, displayNetworkPointer);
	}

	function sendPointerEvent(coordinate) {
		var relativeOffset = coordinate.toRelativeOffset(drawingArea);
		network.sendEvent(new ClientPointerEvent(relativeOffset.x, relativeOffset.y));
	}

	function displayNetworkPointer(serverEvent) {
		var pointerElement = eventIds[serverEvent.id];
		if (pointerElement === undefined) {
			pointerElement = HtmlElement.appendHtmlToBody(pointerHtml);
			eventIds[serverEvent.id] = pointerElement;
		}
		pointerElement.setAbsolutePosition(HtmlCoordinate.fromRelativeOffset(drawingArea, serverEvent.x, serverEvent.y));
	}


	//*** Clear Screen

	function handleClearScreenAction() {
		clearScreenButton.onMouseClick(clearDrawingAreaAndSendEvent);
		network.onEvent(ServerClearScreenEvent, clearDrawingArea);
	}

	function clearDrawingAreaAndSendEvent() {
		clearDrawingArea();
		network.sendEvent(new ClientClearScreenEvent());
	}

	function clearDrawingArea() {
		svgCanvas.clear();
	}


	//*** Drawing

	function handleDrawing() {
		drawingArea.preventBrowserDragDefaults();
		handleMouseDragGesture();
		handleTouchDragGesture();
		handleNetworkDrawing();
	}

	function handleNetworkDrawing() {
		network.onEvent(ServerDrawEvent, function(event) {
			var from = HtmlCoordinate.fromRelativeOffset(drawingArea, event.from.x, event.from.y);
			var to = HtmlCoordinate.fromRelativeOffset(drawingArea, event.to.x, event.to.y);
			drawLineSegment(from, to);
		});
	}

	function handleMouseDragGesture() {
		drawingArea.onMouseDown(startDrag);
		documentBody.onMouseMove(continueDrag);
		windowElement.onMouseUp(endDrag);
	}

	function handleTouchDragGesture() {
		drawingArea.onSingleTouchStart(startDrag);
		drawingArea.onSingleTouchMove(continueDrag);
		drawingArea.onTouchEnd(endDrag);
		drawingArea.onTouchCancel(endDrag);

		drawingArea.onMultiTouchStart(endDrag);
	}

	function startDrag(coordinate) {
		start = coordinate;
	}

	function continueDrag(coordinate) {
		if (!isCurrentlyDrawing()) return;

		var end = coordinate;
		if (!start.equals(end)) {
			drawLineSegmentAndSendDrawEvent(start, end);
			start = end;
			lineDrawn = true;
		}
	}

	function endDrag() {
		if (!isCurrentlyDrawing()) return;

		if (!lineDrawn) drawLineSegmentAndSendDrawEvent(start, start);

		start = null;
		lineDrawn = false;
	}

	function isCurrentlyDrawing() {
		return start !== null;
	}

	function drawLineSegmentAndSendDrawEvent(start, end) {
		drawLineSegment(start, end);
		sendDrawEvent(start, end);
	}

	function drawLineSegment(start, end) {
		if (start.equals(end)) svgCanvas.drawDot(start);
		else svgCanvas.drawLine(start, end);
	}

	function sendDrawEvent(start, end) {
		var startOffset = start.toRelativeOffset(drawingArea);
		var endOffset = end.toRelativeOffset(drawingArea);
		network.sendEvent(new ClientDrawEvent(startOffset.x, startOffset.y, endOffset.x, endOffset.y));
	}

}());