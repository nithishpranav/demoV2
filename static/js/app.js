/*
while staring the server we must get the machine data from the machine contract to the startServer function


*/
function startServer(machineID, userWID,financierWalletID, manufacturerWalletID) {

  var financierWID = financierWalletID
  var manufacturerWID = manufacturerWalletID
  const MAX_DATA_COUNT = 100;
  var socket = io.connect();

  var populateDayChartFlag = true;

  socket.on("updateSensorData", async function (msg) {

    if(populateDayChartFlag){
      await populateDayChart(msg.time_stamp,machineID,userWID);
      populateDayChartFlag = false;
    }

    console.log("Received sensorData :: " + msg.time_stamp + " :: " + msg.value+ " :: " + msg.volt_value+" :: " + msg.rotate_value+"::" + msg.vibration_value+"::" + msg.pressure_value);
    if (myChart.data.labels.length > MAX_DATA_COUNT) {
      removeFirstData();
    }
    addData(msg.time_stamp,msg.volt_value,msg.rotate_value,msg.vibration_value,msg.pressure_value);

  });

  /*
  machine telemetry data chart 
  */
  const ctx = document.getElementById("myChart").getContext("2d");
  const myChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [

        { label: "Voltage",
          borderColor: ['rgba(25, 119, 12, 1)',],
        },
        {
          label: "Rotation",
          borderColor: ['rgba(255, 99, 132, 1)',],
        },
        {
          label: "Vibration",
          borderColor: ['rgba(115, 9, 122, 1)',],
        },
        {
          label: "Pressure",
          borderColor: ['rgba(215, 119, 12, 1)',],
        }
      ],
    }
  });

  const MAX_DAY_USAGE_COUNT = 31;
  const duc = document.getElementById("dayUsageChart");
  const dayUsageChart = new Chart(duc,{
    type: "bar",
    data: {
      //labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10', 'Day 11', 'Day 12', 'Day 13', 'Day 14', 'Day 15', 'Day 16', 'Day 17', 'Day 18', 'Day 19', 'Day 20', 'Day 21', 'Day 22', 'Day 23', 'Day 24', 'Day 25', 'Day 26', 'Day 27', 'Day 28', 'Day 29', 'Day 30', 'Day 31'],
      datasets: [
        {
          label: "Usage",
          //borderColor: ['rgba(25, 119, 12, 1)',],
          backgroundColor: ['rgba(25, 99, 132, 1)',],
      }
    ],
    }
  });

  function addDayUsageData(label, usage) {
    console.log("addDayUsageData "+label+"::"+usage)
    var usage = usage/60;
    if (dayUsageChart.data.labels.length > MAX_DAY_USAGE_COUNT) {
      removeFirstDayUsageData();
    }
    dayUsageChart.data.labels.push(label);
    dayUsageChart.data.datasets[0].data.push(usage);
    dayUsageChart.update();
  }

  function removeFirstDayUsageData() {
    dayUsageChart.data.labels.splice(0, 1);
    dayUsageChart.data.datasets.forEach((dataset) => {
      dataset.data.shift();
    });
  }

  function addData(label, volt_data, rotate_data, vibration_data, pressure_data) {
    myChart.data.labels.push(label);
    myChart.data.datasets[0].data.push(volt_data);
    myChart.data.datasets[1].data.push(rotate_data);
    myChart.data.datasets[2].data.push(vibration_data);
    myChart.data.datasets[3].data.push(pressure_data);
    myChart.update();
    /*
    FORMULA FOR CALCULATING THE USAGE
    Vibration metric
    weight = 0.75
    max = 80
    formula = (value/max)*weight
    COST PER HOUR = 10 tokens per hour
    */
    var usage = (vibration_data/80)*0.75*60;
    console.log("usage"+usage);

    usageContract(machineID,financierWID,usage,label);
    console.log(label);
    var hour = parseInt(label.slice(11,13));
    if (hour === 23){
      var day = label.slice(8,10);
      var dayStamp = machineID+":"+label.slice(0,10);
      getDayUsageData(day,dayStamp);
      //console.log(dayUsage);
      //addDayUsageData(day,dayUsage);
    }
  }

  function getDayUsageData(day,dayStamp) {
    console.log("getDayUsageData"+dayStamp);
    var kld_from = "kld-from="+financierWID;
    var url = "https://u0anrngbym-u0kuxslxro-connect.us0-aws.kaleido.io/instances/0xa8b0124d967f9e18c16d8a5dfcff1bc10ef8cb1c/returnUsage?"+kld_from+"&kld-sync=true";
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Basic dTBwNjgwb3pvMDpqN3dLUHRZa0xrNnBITlNDQTlDckJaNVM3MlBFemtCSGtxbjVSVkdESGRF");
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({"timeStamp":dayStamp});
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };

    fetch(url, requestOptions)
      .then(response => response.json())
      .then(result => {
        console.log(result);
        //return parseInt(result.output);
        var dayUsage = parseInt(result.output);
        console.log(dayUsage);
        addDayUsageData(day,dayUsage);
        
      })
      .catch(error => console.log('error', error));
  }

  function usageContract(machineID,financierWID,usage,label) {
    var daystamp = label.slice(0,10);
    var monthStamp = label.slice(4,10);
    var timeStamp = machineID+":"+label;
    var dayStamp = machineID+":"+daystamp;
    var monthStamp = machineID+":"+monthStamp;
    console.log(dayStamp+" "+timeStamp+" "+usage);
    var kld_from = "kld-from="+financierWID;

    var url = "https://u0anrngbym-u0kuxslxro-connect.us0-aws.kaleido.io/instances/0xa8b0124d967f9e18c16d8a5dfcff1bc10ef8cb1c/recordUsage?"+kld_from+"&kld-sync=true";

    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Basic dTBwNjgwb3pvMDpqN3dLUHRZa0xrNnBITlNDQTlDckJaNVM3MlBFemtCSGtxbjVSVkdESGRF");
    myHeaders.append("Content-Type", "application/json");
    var raw = JSON.stringify({
      "dayStamp": dayStamp,
      "monthStamp": monthStamp,
      "timeStamp": timeStamp,
      "usage": usage,
    });
    //console.log("raw "+raw);
    
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    
    fetch(url, requestOptions)
      .then(response => response.text())
      .catch(error => console.log('error', error));
  }

  function removeFirstData() {
    myChart.data.labels.splice(0, 1);
    myChart.data.datasets.forEach((dataset) => {
      dataset.data.shift();
    });
  }

  async function populateDayChart(time_stamp,machine_id,userWID){
    console.log("populateDayChart");
    console.log(time_stamp);

    var from = new Date(time_stamp);
    from.setDate(from.getDate()-30);
    for(var i=0;i<30;i++){
      
      console.log(from)

      day = from.getDate();
      month = from.getMonth()+1;
      year = from.getFullYear();
      from.setDate(from.getDate()+1);

      if(day<10){
        day = '0'+day;
      }
      if(month<10){
        month = '0'+month;
      }
      time_stamp = machine_id+":"+year+'-'+month+'-'+day;
      const result = await getDayUsageData(day,time_stamp);
      
    }
  }

}





function appear(){
  console.log("appear");
  document.getElementById("view").style.display = "none";
  const hctx = document.getElementById('hChart');

  let delayed;
  let flagOne = true;
  const hChart = new Chart(hctx, {
    type: 'bar',
    data: {
      labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10', 'Day 11', 'Day 12', 'Day 13', 'Day 14', 'Day 15', 'Day 16', 'Day 17', 'Day 18', 'Day 19', 'Day 20', 'Day 21', 'Day 22', 'Day 23', 'Day 24', 'Day 25', 'Day 26', 'Day 27', 'Day 28', 'Day 29', 'Day 30', 'Day 31'],
      datasets: [{
        label: '# of Hours Used',
        data: [12, 10, 3, 5, 2, 3, 1, 2, 3, 4, 5, 6, 7, 10, 9, 1, 4, 12, 6, 8, 7, 2, 4, 3, 9, 2, 4, 6, 5, 4, 10],
        borderWidth: 1
      }]
    }, 
    options: {
      animation:{
        onComplete: () => {delayed = true
          if(flagOne){
          console.log("animation complete");
          document.getElementById("generateBill").style.display = "block";
          flagOne = false;
          }
        },
        delay: (context) => {
          let delay = 0;
          if (context.type === 'data' && context.mode === 'default' && !delayed) {
            delay = context.dataIndex * 300 + context.datasetIndex * 100;
            console.log(delay);
          }
          return delay;
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

}


//pie chart
var myPieChart = null
  var config = {
    options:{
          responsive:true,
          rotation: -90,
          circumference: 180,
    },
    type:'pie'}
  function pchart(ftb,mtb) {
      var ftb = ftb,
        mtb = mtb,
        ctx = document.getElementById('pieChart').getContext('2d');
                    config.data = {
        labels: ["Financier","Manufacturer"],
        datasets:
            [{
              data: [ftb,mtb],
              backgroundColor: ["#cd3e51", "#1d76db"],
            }]
      };
      if(myPieChart == null){
                        myPieChart = new Chart(ctx, config);
                    }else{
                        myPieChart.update()
                    }
  }