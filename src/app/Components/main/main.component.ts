import {AfterViewInit, Component} from '@angular/core';
import {saveAs} from "file-saver";
import * as tf from '@tensorflow/tfjs';


@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements AfterViewInit {
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
  paintCanvasHeight = 400;
  paintCanvasWidth = 400;
  rescalerOn = true;

  constructor() {
  }

  ngAfterViewInit() {
    this.paintCanvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.context = this.paintCanvas.getContext('2d');
    this.context.lineCap = 'round';
    this.context.lineWidth = 2;
    this.context.strokeStyle = "black";
    this.context.fillStyle = "white";
    this.context.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height)
    this.addEvents();
    this.minX = this.paintCanvas.width;
    this.minY = this.paintCanvas.height;
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
  }

  stopDrawing() {
    this.isMouseDown = false;
  }

  drawLine(event: any) {
    if (this.isMouseDown) {
      const newX = event.offsetX;
      const newY = event.offsetY;
      this.trackValues(newX, newY);
      this.context.beginPath();
      this.context.moveTo(this.x, this.y);
      this.context.lineTo(newX, newY);
      this.context.stroke();
      this.x = newX;
      this.y = newY;
    }
  }

  async evaluate() {

    let model: any = await tf.loadLayersModel("http://localhost:4200/assets/model.json");
    let canvasToEvaluate: HTMLCanvasElement;
    console.log(this.minX, this.maxX, this.minY, this.maxY);

    if (this.rescalerOn) canvasToEvaluate = this.cropImageFromCanvas();
    else canvasToEvaluate = this.paintCanvas;

    let inputTensor = tf.browser.fromPixels(canvasToEvaluate, 3)// imageResult is an <img/> tag
      .resizeBilinear([255, 255])
      .reshape([1, 255, 255, 3])
      .cast('float32');
    let predictionResult = model.predict(inputTensor).dataSync();
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

  cropImageFromCanvas() {
    const resultCanvas: HTMLCanvasElement = document.createElement("canvas");
    let w = 1 + this.maxX - this.minX;
    let h = 1 + this.maxY - this.minY;

    const cut = this.context.getImageData(this.minX, this.minY, this.maxX, this.maxY);

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
    this.paintCanvas.width = this.paintCanvasWidth;
    this.paintCanvas.height = this.paintCanvasHeight;
    this.maxX = 0;
    this.maxY = 0;
    this.minX = this.paintCanvasWidth;
    this.minY = this.paintCanvasHeight;
    this.context.lineCap = 'round';
    this.context.lineWidth = 2;
    this.context.fillStyle = "white";
    this.context.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height)
    document.getElementById("output")!.innerHTML = "";
  }

  download() {
    this.paintCanvas.toBlob((blob: any) => {
      saveAs(blob, "image.png")
    });
  }
}
