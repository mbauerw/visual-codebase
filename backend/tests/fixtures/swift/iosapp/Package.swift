// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "IOSApp",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(name: "IOSApp", targets: ["IOSApp"])
    ],
    dependencies: [],
    targets: [
        .target(name: "IOSApp", dependencies: []),
        .testTarget(name: "IOSAppTests", dependencies: ["IOSApp"])
    ]
)
