import 'dart:math';
import 'package:flutter/material.dart';

// This is a custom widget to create a magical particle effect.
// It is fully null-safe and does not require an external package.
class ParticlesWidget extends StatefulWidget {
  final int numberOfParticles;
  final Color baseColor;

  const ParticlesWidget({
    super.key,
    this.numberOfParticles = 50,
    this.baseColor = Colors.white,
  });

  @override
  State<ParticlesWidget> createState() => _ParticlesWidgetState();
}

class _ParticlesWidgetState extends State<ParticlesWidget>
    with TickerProviderStateMixin {
  late final List<Particle> particles;
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 10),
      vsync: this,
    )..repeat();
    // Corrected to create a list of Particle objects, which is the correct type.
    particles = List.generate(
        widget.numberOfParticles, (index) => Particle(widget.baseColor));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        _updateParticles();
        // The ParticlePainter correctly handles the List<Particle>
        return CustomPaint(
          painter: ParticlePainter(particles),
          // Set a size for the CustomPaint to fill the available space
          size: Size.infinite,
        );
      },
    );
  }

  void _updateParticles() {
    for (var particle in particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.opacity -= 0.01;
      if (particle.opacity <= 0) {
        _resetParticle(particle);
      }
    }
  }

  void _resetParticle(Particle particle) {
    final random = Random();
    particle.x = random.nextDouble() * MediaQuery.of(context).size.width;
    particle.y = random.nextDouble() * MediaQuery.of(context).size.height;
    particle.opacity = random.nextDouble() * 0.5 + 0.5;
    particle.size = random.nextDouble() * 2 + 1;
    particle.vx = random.nextDouble() * 0.5 - 0.25;
    particle.vy = random.nextDouble() * 0.5 - 0.25;
  }
}

class Particle {
  double x;
  double y;
  double vx;
  double vy;
  double opacity;
  double size;
  Color color;

  Particle(this.color)
      : x = Random().nextDouble() * 400,
        y = Random().nextDouble() * 800,
        vx = Random().nextDouble() * 0.5 - 0.25,
        vy = Random().nextDouble() * 0.5 - 0.25,
        opacity = Random().nextDouble() * 0.5 + 0.5,
        size = Random().nextDouble() * 2 + 1;
}

class ParticlePainter extends CustomPainter {
  final List<Particle> particles;

  ParticlePainter(this.particles);

  @override
  void paint(Canvas canvas, Size size) {
    for (var particle in particles) {
      final paint = Paint()
        ..color = particle.color.withOpacity(particle.opacity)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(particle.x, particle.y), particle.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return true;
  }
}
