import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

class LottieTransitionScreen extends StatelessWidget {
  const LottieTransitionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Lottie.network(
          '[https://lottie.host/dd595d24-d2e8-4665-ac52-ef15a1f6a5cf/85X2Bq7Yd3.json](https://lottie.host/dd595d24-d2e8-4665-ac52-ef15a1f6a5cf/85X2Bq7Yd3.json)',
          onLoaded: (composition) {
            // Dismiss the transition screen after the animation finishes
            Future.delayed(composition.duration, () {
              Navigator.of(context).pop();
            });
          },
        ),
      ),
    );
  }
}
