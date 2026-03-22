import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
  fputs("Usage: swift ocr_image.swift <image-path>\n", stderr)
  exit(1)
}

let imagePath = CommandLine.arguments[1]
let imageURL = URL(fileURLWithPath: imagePath)

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

do {
  let handler = try VNImageRequestHandler(url: imageURL)
  try handler.perform([request])

  let observations = request.results ?? []
  let text = observations
    .compactMap { $0.topCandidates(1).first?.string }
    .joined(separator: "\n")
    .trimmingCharacters(in: .whitespacesAndNewlines)

  print(text)
} catch {
  fputs("OCR failed: \(error.localizedDescription)\n", stderr)
  exit(2)
}
