angular.module('stockDashbord.services', [])

.factory('encodeURIService', function(){

  return {
    encode: function(string){
      return encodeURIComponent(string)
        .replace(/\"/g, "%22")
        .replace(/\ /g, "%28")
        .replace(/[!'()]/g, escape);
    }
  };
})


.factory('dateService', function($filter){

var currentDate = function(){
  var d = new Date();
  var date = $filter('date')(d, 'yyyy-MM-dd');
  return date;
};

var oneYearAgoDate = function(){
  var d = new Date(new Date().setDate(new Date().getDate()-365));
  var date = $filter('date')(d, 'yyyy-MM-dd');
  return date;
};

return {
  currentDate: currentDate,
  oneYearAgoDate: oneYearAgoDate
};

})


.factory('chartDataCacheService', function(CacheFactory){

  var chartDataCache;

if(!CacheFactory.get('chartDataCache')){

  chartDataCache = CacheFactory('chartDataCache', {
    maxAge: 60 * 60 * 8 * 1000,
    deleteOnExpire: 'aggressive',
    storageMode: 'localStorage'
  });
}
else {
  chartDataCache = CacheFactory.get('chartDataCache');
}

  return chartDataCache;

})

.factory('stockDetailsCacheService', function(CacheFactory){

  var stockDetailsCache;

if(!CacheFactory.get('stockDetailsCache')){

  stockDetailsCache = CacheFactory('stockDetailsCache', {
    maxAge: 60 * 60 * 8 * 1000,
    deleteOnExpire: 'aggressive',
    storageMode: 'localStorage'
  });
}
else {
  stockDetailsCache = CacheFactory.get('stockDetailsCache');
}

  return stockDetailsCache;

})


.factory('notesCacheService', function(CacheFactory) {

  var notesCache;

  if(!CacheFactory.get('notesCache')){

    notesCache = CacheFactory('notesCache', {
      storageMode: 'localStorage'
    });
  }
  else {
    notesCache = CacheFactory.get('notesCache');
  }

  return notesCache;

})


.factory('stockDataService', function ($q, $http, encodeURIService, stockDetailsCacheService){

  var getDetailData = function(ticker){

    var deferred = $q.defer(),

    cacheKey = ticker,
    stockDetailsCache = stockDetailsCacheService.get(cacheKey),

    query = 'select * from yahoo.finance.quotes where symbol IN ("' + ticker + '")',
    url ='http://query.yahooapis.com/v1/public/yql?q=' + encodeURIService.encode(query) + '&format=json&env=http://datatables.org/alltables.env';


    if (stockDetailsCache){
      deferred.resolve(stockDetailsCache);
    }
    else{
      $http.get(url)
        .success(function(json){
          var jsonData = json.query.results.quote;
          deferred.resolve(jsonData);
          stockDetailsCacheService.put(cacheKey, jsonData);
        })
        .error(function(error){
          console.log("Details data error: "+error);
          deferred.reject();
        });
    }

      return deferred.promise;

  };

  var getPriceData = function(ticker){

    var deferred = $q.defer(),
    url ="http://finance.yahoo.com/webservice/v1/symbols/"+ ticker +"/quote?format=json&view=detail";

    $http.get(url)
      .success(function(json){
        var jsonData = json.list.resources[0].resource.fields;
        deferred.resolve(jsonData);

      })
      .error(function(error){
        console.log("Price data error: "+error);
        deferred.reject();
      });

    return deferred.promise;

  };

  return {
    getPriceData: getPriceData,
    getDetailData: getDetailData
  };
})

.factory('chartDataService', function($q, $http, encodeURIService, chartDataCacheService){

  var getHistoricalData = function(ticker, fromDate, todayDate){
    // select * from yahoo.finance.historicaldata where symbol = "YHOO" and startDate = "2009-09-11" and endDate = "2010-03-10"
    var deferred = $q.defer(),

    cacheKey = ticker,
    chartDataChache = chartDataCacheService.get(cacheKey),

    query ='select * from yahoo.finance.historicaldata where symbol = "' + ticker + '" and startDate = "' + fromDate+ '" and endDate = "'+todayDate+'"',
    url ='http://query.yahooapis.com/v1/public/yql?q=' + encodeURIService.encode(query) + '&format=json&env=http://datatables.org/alltables.env';

    if (chartDataChache){
      deferred.resolve(chartDataChache);
    }
    else{
      $http.get(url)
        .success(function(json){
          var jsonData = json.query.results.quote;

          var priceData = [],
          volumeData = [];

          jsonData.forEach(function(dayDataObject){
            var dateToMillis = dayDataObject.Date,
            date = Date.parse(dateToMillis),
            price = parseFloat(Math.round(dayDataObject.Close *100) / 100).toFixed(3),
            volume = dayDataObject.Volume,

            volumeDatum = '[' + date + ',' + volume + ']',
            priceDatum = '[' + date + ',' + price + ']';

            volumeData.unshift(volumeDatum);
            priceData.unshift(priceDatum);

          });

  var formattedChartData = '[{'+
      '"key":' + '"volume",' +
      '"bar":' + 'true,' +
      '"values":' + '[' + volumeData + ']' +
      '},' +
      '{' +
      '"key":' + '"' + ticker + '",' +
      '"values":' + '[' + priceData + ']' +
      '}]';

          deferred.resolve(formattedChartData);
          chartDataCacheService.put(cacheKey, formattedChartData);

        })
        .error(function(error){
          console.log("Chart data error: "+error);
          deferred.reject();
        });
    }

      return deferred.promise;

  };

  return {
    getHistoricalData: getHistoricalData
  };

})

.factory('notesService', function(notesCacheService){

  return {

    getNotes: function(ticker){
      return notesCacheService.get(ticker);
    },

    addNotes: function(ticker, note){

      var stockNotes = [];

      if (notesCacheService.get(ticker)){

        stockNotes = notesCacheService.get(ticker);
        stockNotes.push(note);
      }
      else {
        stockNotes.push(note);
      }

      notesCacheService.put(ticker, stockNotes);
    },

    deleteNotes: function(ticker, index){

      var stockNotes = [];

      stockNotes = notesCacheService.get(ticker);
      stockNotes.splice(index,1);
      notesCacheService.put(ticker, stockNotes);

    }
  };
})

.factory('newsService', function($q, $http){

    return{
        getNews: function(ticker){
          var deferred = $q.defer(),
          x2js = new X2JS(),
          url = "http://finance.yahoo.com/rss/headline?s=" + ticker;

          $http.get(url)
            .success(function(xml){
              var xmlDoc = x2js.parseXmlString(xml),
              json = x2js.xml2json(xmlDoc),
              jsonData = json.rss.channel.item;
              deferred.resolve(jsonData);
            })
            .error(function(error){
              deferred.reject();
              console.log("News error:" +  error);
            });

            return deferred.promise;
        }
    };

})

;
