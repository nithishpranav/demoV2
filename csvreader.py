import csv
import time
with open('hourUsage.csv', 'r') as f:
    reader = csv.reader(f)
    for row in reader:
        print(row)

        
        time.sleep(1)
        