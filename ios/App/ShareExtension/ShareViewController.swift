// WRLD share extension: "Share → WRLD" from TikTok, Instagram, YouTube,
// Safari, Maps… Takes the shared link/text and opens the WRLD app at its
// /share page (via the wrld:// URL scheme in App/Info.plist).
//
// Add it in Xcode on a Mac (one time):
//   1. File → New → Target… → Share Extension. Name it "ShareExtension",
//      language Swift. When asked to activate the scheme, choose Activate.
//   2. Replace the generated ShareViewController.swift with this file, and
//      delete the generated MainInterface.storyboard.
//   3. In ShareExtension/Info.plist set NSExtension → NSExtensionPrincipalClass
//      to $(PRODUCT_MODULE_NAME).ShareViewController (remove
//      NSExtensionMainStoryboard), and NSExtensionActivationRule to accept
//      web URLs and text (NSExtensionActivationSupportsWebURLWithMaxCount = 1,
//      NSExtensionActivationSupportsText = YES).
//   4. Bundle identifier: com.wrldtrips.app.ShareExtension (same team as the app).
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { await handleShare() }
    }

    private func handleShare() async {
        var sharedURL: String?
        var sharedText: String?
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        for item in items {
            for provider in item.attachments ?? [] {
                if sharedURL == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    sharedURL = url.absoluteString
                }
                if sharedText == nil, provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    sharedText = text
                }
            }
        }

        var components = URLComponents()
        components.scheme = "wrld"
        components.host = "share"
        components.queryItems = [
            sharedURL.map { URLQueryItem(name: "url", value: $0) },
            sharedText.map { URLQueryItem(name: "text", value: String($0.prefix(1500))) },
        ].compactMap { $0 }

        if let target = components.url { await openContainingApp(target) }
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Share extensions can't call UIApplication.shared directly; walk the responder chain.
    @MainActor private func openContainingApp(_ url: URL) async {
        var responder: UIResponder? = self
        while let current = responder {
            if let app = current as? UIApplication {
                app.open(url)
                return
            }
            responder = current.next
        }
    }
}
