import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'custom_particle_widget.dart';
import 'report_page.dart';

class ProductDetailsPage extends StatelessWidget {
  final Map<String, dynamic> product;

  const ProductDetailsPage({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final productName = product['productName'] as String? ?? 'N/A';
    final productHash = product['productHash'] as String? ?? 'N/A';
    final expiryDate = product['expiryDate'] as String? ?? 'N/A';
    final batchNumber = product['batchNumber'] as String? ?? 'N/A';
    final qcStatus = product['qcStatus'] as String? ?? 'N/A';
    final overallStatus = product['overallStatus'] as String? ?? 'N/A';

    final shouldShowReportButton =
        overallStatus == 'QC_FAIL ❌' || overallStatus == 'COUNTERFEIT ❌';

    return Scaffold(
      appBar: AppBar(
        title: Text(productName),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Stack(
        children: [
          const ParticlesWidget(
            numberOfParticles: 100,
            baseColor: Colors.purple,
          ),
          SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildDetailCard(
                  title: localizations.productNameLabel,
                  content: productName,
                ),
                _buildDetailCard(
                  title: localizations.productIDLabel,
                  content: productHash,
                ),
                _buildDetailCard(
                  title: localizations.batchNumberLabel,
                  content: batchNumber,
                ),
                _buildDetailCard(
                  title: localizations.expiryLabel,
                  content: expiryDate,
                ),
                _buildDetailCard(
                  title: localizations.qcStatusLabel,
                  content: qcStatus,
                ),
                _buildDetailCard(
                  title: localizations.overallStatusLabel,
                  content: overallStatus,
                ),
                if (shouldShowReportButton) ...[
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReportProductPage(
                            productHash: productHash,
                            productName: productName,
                            status: overallStatus,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.flag, color: Colors.white),
                    label: Text(localizations.reportCounterfeitButton),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      textStyle: const TextStyle(fontSize: 16),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailCard({required String title, required String content}) {
    return Card(
      color: Colors.white.withOpacity(0.1),
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              content,
              style: const TextStyle(fontSize: 16, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
