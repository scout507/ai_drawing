import {AfterViewInit, Component} from '@angular/core';
import {saveAs} from "file-saver";
import * as tf from '@tensorflow/tfjs';


@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements AfterViewInit {
  model: any;
  paintCanvas!: HTMLCanvasElement;
  context: any;
  x = 0;
  y = 0;
  isMouseDown = false;
  labels = ["apple", "campfire", "diamond", "donut", "face", "fish", "hand", "house", "pizza", "t-shirt"]
  minX = 1000;
  minY = 1000;
  maxX = 0;
  maxY = 0;
  canvasHeight = 400;
  canvasWidth = 400;
  rescalerOn = true;

  strokeLength = 15;
  smoothingON = false;
  canvasBackgroundHidden = true;
  canvasBackground: any;
  contextBackground: any;
  xBackground = 0;
  yBackground = 0;
  minXBackground = 1000;
  minYBackground = 1000;
  maxXBackground = 0;
  maxYBackground = 0;


  constructor() {
  }

  ngAfterViewInit() {
    this.paintCanvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.context = this.paintCanvas.getContext('2d');

    this.canvasBackground = document.getElementById('canvas2') as HTMLCanvasElement;
    this.contextBackground = this.canvasBackground.getContext('2d');

    this.setupContext(this.context);
    this.setupContext(this.contextBackground);
    this.addEvents();
    this.minX = this.canvasWidth;
    this.minY = this.canvasHeight;

    this.minXBackground = this.canvasWidth;
    this.minYBackground = this.canvasHeight;
    this.loadModel().then();
  }

  async loadModel() {
    this.model = await tf.loadLayersModel("./assets/model.json");
  }

  setupContext(context: any) {
    context.lineCap = 'round';
    context.lineWidth = 2;
    context.strokeStyle = "black";
    context.fillStyle = "white";
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  addEvents() {
    this.paintCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.paintCanvas.addEventListener('mousemove', this.drawLine.bind(this));
    this.paintCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.paintCanvas.addEventListener('mouseout', this.stopDrawing.bind(this));
  }

  startDrawing(event: any) {
    this.isMouseDown = true;
    [this.x, this.y] = [event.offsetX, event.offsetY];
    [this.xBackground, this.yBackground] = [event.offsetX, event.offsetY];
  }

  stopDrawing() {
    this.isMouseDown = false;
  }

  drawLine(event: any) {
    if (this.isMouseDown) {
      const newX = event.offsetX;
      const newY = event.offsetY;

      this.drawLineBackground(newX, newY);

      this.trackValues(newX, newY);
      this.context.beginPath();
      this.context.moveTo(this.x, this.y);
      this.context.lineTo(newX, newY);
      this.context.stroke();
      this.x = newX;
      this.y = newY;
    }
  }

  drawLineBackground(newX: number, newY: number) {
    if (this.getDistance(this.xBackground, newX, this.yBackground, newY) >= this.strokeLength) {
      if (newX > this.maxXBackground) this.maxXBackground = newX;
      if (newX < this.minXBackground) this.minXBackground = newX;
      if (newY > this.maxYBackground) this.maxYBackground = newY;
      if (newY < this.minYBackground) this.minYBackground = newY;
      this.contextBackground.beginPath();
      this.contextBackground.moveTo(this.xBackground, this.yBackground);
      this.contextBackground.lineTo(newX, newY);
      this.contextBackground.stroke();
      this.xBackground = newX;
      this.yBackground = newY;
    }
  }

  evaluate() {
    if (this.maxX == 0) {
      document.getElementById("output")!.innerHTML = "";
      return
    }

    let canvasToEvaluate: HTMLCanvasElement;

    if (this.smoothingON) canvasToEvaluate = this.canvasBackground;
    else canvasToEvaluate = this.paintCanvas;

    if (this.rescalerOn) canvasToEvaluate = this.cropImageFromCanvas(canvasToEvaluate, this.smoothingON);

    let inputTensor = tf.browser.fromPixels(canvasToEvaluate, 3)// imageResult is an <img/> tag
      .resizeBilinear([255, 255])
      .reshape([1, 255, 255, 3])
      .cast('float32');
    let predictionResult = this.model.predict(inputTensor).dataSync();
    let recognizedDigit = predictionResult.indexOf(Math.max(...predictionResult));
    let sum = 0;

    predictionResult.forEach((prediction: number) => {
      if (prediction > 0) sum += prediction;
    })

    this.resultList(predictionResult, sum);
    document.getElementById("output")!.innerHTML = this.labels[recognizedDigit] + "  " + Math.round(predictionResult[recognizedDigit] * 100 / sum) + "%";
  }

  trackValues(x: number, y: number) {
    if (x > this.maxX) this.maxX = x;
    if (x < this.minX) this.minX = x;
    if (y > this.maxY) this.maxY = y;
    if (y < this.minY) this.minY = y;
  }

  cropImageFromCanvas(canvas: HTMLCanvasElement, background: boolean) {

    const resultCanvas: HTMLCanvasElement = document.createElement("canvas");

    let cut = canvas.getContext("2d")!.getImageData(this.minX, this.minY, this.maxX, this.maxY);

    let w = 1 + this.maxX - this.minX;
    let h = 1 + this.maxY - this.minY;

    if (background) {
      w = 1 + this.maxXBackground - this.minXBackground;
      h = 1 + this.maxYBackground - this.minYBackground;
      cut = canvas.getContext("2d")!.getImageData(this.minXBackground, this.minYBackground, this.maxXBackground, this.maxYBackground);
    }


    if (w > h) {
      resultCanvas.width = w;
      resultCanvas.height = w;
    } else {
      resultCanvas.width = h;
      resultCanvas.height = h;
    }
    resultCanvas.getContext("2d")!.putImageData(cut, 0, 0);
    return resultCanvas;
  }


  resultList(results: any, sum: number) {
    console.log("Results:")
    for (let i = 0; i < results.length; i++) {
      if (results[i] > 0) console.log(this.labels[i] + ": " + results[i] + "  Accuracy: " + (results[i] / sum));
    }
  }

  clear() {
    this.maxX = 0;
    this.maxY = 0;
    this.minX = this.canvasWidth;
    this.minY = this.canvasHeight;

    this.maxXBackground = 0;
    this.maxYBackground = 0;
    this.minXBackground = this.canvasWidth;
    this.minYBackground = this.canvasHeight;

    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.contextBackground.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    document.getElementById("output")!.innerHTML = "";
  }

  download() {
    let canvasToEvaluate: HTMLCanvasElement;
    let filename = "image"
    if (this.smoothingON) {
      canvasToEvaluate = this.canvasBackground;
      filename += "_smo"
    } else canvasToEvaluate = this.paintCanvas;

    if (this.rescalerOn) {
      filename += "_re"
      canvasToEvaluate = this.cropImageFromCanvas(canvasToEvaluate, this.smoothingON);
    }

    canvasToEvaluate.toBlob((blob: any) => {
      saveAs(blob, filename + ".png")
    });
  }

  getDistance(x1: number, x2: number, y1: number, y2: number):
    number {
    let x = x1 - x2;
    let y = y1 - y2;
    return Math.sqrt((x * x + y * y));
  }
}
