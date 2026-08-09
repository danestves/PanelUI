import {
	type ConfigPlugin,
	withAppDelegate,
	withInfoPlist,
} from "expo/config-plugins";

const MARKER = "// @generated with-ui-scene";

// The iOS 27 SDK (Xcode 27) requires the UIScene lifecycle: apps linked against
// it that still use the legacy AppDelegate/window lifecycle are killed at launch
// in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption. Expo's
// prebuild template has not adopted scenes yet (expo/expo#46664), so this plugin
// moves window creation + startReactNative into a SceneDelegate and declares the
// scene manifest. Delete this plugin once Expo ships official UIScene adoption.

const WINDOW_BLOCK_ANCHOR = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const WINDOW_BLOCK_REPLACEMENT = `${MARKER}
    self.launchOptions = launchOptions`;

const WINDOW_PROPERTY_ANCHOR = "var window: UIWindow?";

const WINDOW_PROPERTY_REPLACEMENT = `var window: UIWindow?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?`;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)
    window.makeKeyAndVisible()

    for urlContext in connectionOptions.urlContexts {
      _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: [:])
    }
    for userActivity in connectionOptions.userActivities {
      _ = appDelegate.application(
        UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

const withSceneManifest: ConfigPlugin = (config) =>
	withInfoPlist(config, (plistConfig) => {
		plistConfig.modResults.UIApplicationSceneManifest = {
			UIApplicationSupportsMultipleScenes: false,
			UISceneConfigurations: {
				UIWindowSceneSessionRoleApplication: [
					{
						UISceneConfigurationName: "Default Configuration",
						UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
					},
				],
			},
		};
		return plistConfig;
	});

const withSceneDelegate: ConfigPlugin = (config) =>
	withAppDelegate(config, (appDelegateConfig) => {
		const { contents, language } = appDelegateConfig.modResults;
		if (language !== "swift") {
			throw new Error(
				`withUIScene: expected a Swift AppDelegate, got "${language}". The Expo template may have changed; update this plugin.`,
			);
		}
		if (contents.includes(MARKER)) {
			return appDelegateConfig;
		}
		if (
			!(
				contents.includes(WINDOW_BLOCK_ANCHOR) &&
				contents.includes(WINDOW_PROPERTY_ANCHOR)
			)
		) {
			throw new Error(
				"withUIScene: could not find the window creation block in AppDelegate.swift. The Expo template may have changed; update this plugin.",
			);
		}

		appDelegateConfig.modResults.contents = `${contents
			.replace(WINDOW_BLOCK_ANCHOR, WINDOW_BLOCK_REPLACEMENT)
			.replace(
				WINDOW_PROPERTY_ANCHOR,
				WINDOW_PROPERTY_REPLACEMENT,
			)}${SCENE_DELEGATE}`;
		return appDelegateConfig;
	});

const withUIScene: ConfigPlugin = (config) =>
	withSceneDelegate(withSceneManifest(config));

export default withUIScene;
