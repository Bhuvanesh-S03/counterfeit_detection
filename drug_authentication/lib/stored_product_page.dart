import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'custom_particle_widget.dart';

import 'package:drug_authentication/product_details_page.dart';

class StoredProductsPage extends StatelessWidget {
  const StoredProductsPage({super.key});

  // Function to delete a product from Firebase Firestore
  Future<void> _deleteProduct(BuildContext context, String docId) async {
    try {
      await FirebaseFirestore.instance.collection('scans').doc(docId).delete();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Product deleted successfully."),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Failed to delete product: $e"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final userId = FirebaseAuth.instance.currentUser?.uid;

    if (userId == null) {
      return Scaffold(
        appBar: AppBar(title: Text(localizations.myProductsRole)),
        body: const Center(child: Text("Please log in to view products.")),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.myProductsRole),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Stack(
        children: [
          const ParticlesWidget(
            numberOfParticles: 100,
            baseColor: Colors.purple,
          ),
          StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('scans')
                .where('userId', isEqualTo: userId)
                .snapshots(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                return Center(
                  child: Text(
                    localizations.noProductsMessage,
                    style: const TextStyle(fontSize: 16, color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                );
              }

              final products = snapshot.data!.docs;
              return ListView.builder(
                padding: const EdgeInsets.all(16.0),
                itemCount: products.length,
                itemBuilder: (context, index) {
                  final product =
                      products[index].data() as Map<String, dynamic>;
                  final docId = products[index].id;
                  final productName =
                      product['productName'] as String? ?? 'N/A';
                  final expiryDate = product['expiryDate'] as String? ?? 'N/A';
                  final status =
                      product['overallStatus'] as String? ?? 'Pending';

                  return Dismissible(
                    key: Key(docId),
                    background: Container(
                      color: Colors.red,
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20.0),
                      child: const Icon(
                        Icons.delete,
                        color: Colors.white,
                      ),
                    ),
                    direction: DismissDirection.endToStart,
                    onDismissed: (direction) {
                      _deleteProduct(context, docId);
                    },
                    child: Card(
                      color: Colors.white.withOpacity(0.1),
                      margin: const EdgeInsets.symmetric(
                          horizontal: 0, vertical: 8),
                      child: ListTile(
                        title: Text(productName),
                        subtitle: Text('Expiry: $expiryDate\nStatus: $status'),
                        trailing: const Icon(Icons.arrow_forward_ios),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) =>
                                  ProductDetailsPage(product: product),
                            ),
                          );
                        },
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}
